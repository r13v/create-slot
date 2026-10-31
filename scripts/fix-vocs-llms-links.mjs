import { copyFile, readdir, readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { normalizeBasePath } from "./fix-vocs-skip-links.mjs"

const publicRoot = new URL("../docs-site/dist/public/", import.meta.url)
const markdownRoot = new URL("assets/md/", publicRoot)
const rootLinkPattern = /\]\((\/[^)\s]*)/g
const fencePattern = /^\s{0,3}(`{3,}|~{3,})(.*)$/

if (isMain()) {
  await patchMarkdownFiles(process.env.BASE_PATH ?? "/")
}

/**
 * Adds the base path to the links of the LLM files after the build. The Vocs
 * Markdown validation does not know the base path, so this cannot run in
 * `markdown.output.transform`.
 *
 * `llms.txt` links each page as `/<page>.md`, which a Vocs server answers from
 * `/assets/md/<page>.md`. GitHub Pages has no server, so this writes a copy of
 * each page Markdown at `<page>.md`.
 */
async function patchMarkdownFiles(basePathValue) {
  const pages = (await readdir(markdownRoot, { recursive: true })).filter(
    (name) => name.endsWith(".md"),
  )
  const files = [
    new URL("llms.txt", publicRoot),
    new URL("llms-full.txt", publicRoot),
    ...pages.map((name) => new URL(name, markdownRoot)),
  ]

  for (const file of files) {
    const source = await readFile(file, "utf8")
    const output = prefixMarkdownLinks(source, basePathValue)

    if (output !== source) {
      await writeFile(file, output)
    }
  }

  for (const name of pages) {
    await copyFile(new URL(name, markdownRoot), new URL(name, publicRoot))
  }
}

function isMain() {
  return (
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(process.argv[1]).href
  )
}

/** Adds the base path to root-relative Markdown links outside code. */
export function prefixMarkdownLinks(markdown, basePathValue) {
  const basePath = normalizeBasePath(basePathValue)
  if (basePath === "") return markdown

  return mapProseLines(markdown, (line) =>
    mapOutsideInlineCode(line, (text) =>
      text.replace(rootLinkPattern, (_link, href) => {
        return `](${prefixHref(href, basePath)}`
      }),
    ),
  )
}

/** Calls `rewrite` on each line outside code fences. */
export function mapProseLines(markdown, rewrite) {
  return Array.from(markdownLines(markdown), ({ line, prose }) =>
    prose ? rewrite(line) : line,
  ).join("\n")
}

/** Calls `rewrite` on each part of the line outside inline code spans. */
export function mapOutsideInlineCode(line, rewrite) {
  return inlineCodeParts(line)
    .map((part, index) => (index % 2 === 0 ? rewrite(part) : part))
    .join("")
}

/** Yields each part of the Markdown outside code fences and inline code spans. */
export function* proseSegments(markdown) {
  for (const { line, prose } of markdownLines(markdown)) {
    if (prose) {
      yield* inlineCodeParts(line).filter((_part, index) => index % 2 === 0)
    }
  }
}

/** Yields each line, with `prose: false` for fence lines and lines inside a fence. */
function* markdownLines(markdown) {
  let fence = null

  for (const line of markdown.split("\n")) {
    const [, marker, info] = line.match(fencePattern) ?? []

    if (fence !== null) {
      if (
        marker?.[0] === fence[0] &&
        marker.length >= fence.length &&
        info.trim() === ""
      ) {
        fence = null
      }
      yield { line, prose: false }
    } else if (marker !== undefined) {
      fence = marker
      yield { line, prose: false }
    } else {
      yield { line, prose: true }
    }
  }
}

/**
 * Splits a line so that the odd indexes are inline code spans. A span opens
 * with a run of backticks and closes with a run of the same length.
 */
function inlineCodeParts(line) {
  const token = /`+/g
  const parts = []
  let textStart = 0

  for (let match = token.exec(line); match !== null; match = token.exec(line)) {
    const close = new RegExp(`(?<!\`)${match[0]}(?!\`)`, "g")
    close.lastIndex = token.lastIndex

    if (close.exec(line) !== null) {
      parts.push(line.slice(textStart, match.index))
      parts.push(line.slice(match.index, close.lastIndex))
      textStart = close.lastIndex
      token.lastIndex = close.lastIndex
    }
  }

  parts.push(line.slice(textStart))
  return parts
}

function prefixHref(href, basePath) {
  if (href.startsWith("//") || hasBasePath(href, basePath)) {
    return href
  }

  const index = href.match(/^\/index(?=$|[/?#])\/?(.*)$/)

  if (index !== null) {
    return `${basePath}/${index[1]}`
  }

  return `${basePath}${href}`
}

function hasBasePath(href, basePath) {
  const rest = href.slice(basePath.length)

  return href.startsWith(basePath) && (rest === "" || /^[/#?]/.test(rest))
}
