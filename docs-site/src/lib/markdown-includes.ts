import { readFileSync } from "node:fs"
import { resolve } from "node:path"

type MarkdownNode = { children?: MarkdownNode[]; type: string; value?: string }

const includePattern =
  /^\s*\/\/ \[!include ([^\s:\]]+)(?::([^\s\]]+))?(.*)\]\s*$/
const regionMarkerPattern = /^\s*\/\/ \[!(end)?region (.*)\]\s*$/
const cutPattern = /^\s*\/\/ ---cut(-before|-after)?---\s*$/
// `// @ts-expect-error` and similar pragmas are code, not Twoslash directives.
const twoslashDirectivePattern = /^\s*\/\/\s*(@(?!ts-)|\^\?)/

/**
 * Vocs resolves `// [!include ~/snippets/…]` only in the HTML page, so the
 * Markdown output (`llms.txt`, `llms-full.txt`, `assets/md`) keeps the bare
 * include line. This puts the snippet code there, as the reader of the HTML
 * page sees it: the part before `// ---cut---` and the Twoslash directives
 * stay hidden.
 */
export function remarkSnippetIncludes(options: { srcDir: string }) {
  return (tree: unknown) => {
    visitCode(tree as MarkdownNode, (node) => {
      node.value = resolveIncludes(node.value ?? "", (fileName) =>
        readFileSync(resolve(options.srcDir, fileName), "utf8"),
      )
    })
  }
}

export function resolveIncludes(
  code: string,
  readSource: (fileName: string) => string,
): string {
  const lines = code.split("\n").flatMap((line) => {
    const match = line.match(includePattern)
    if (match === null) return [line]

    const [, fileName = "", region, rest = ""] = match
    // A missing include must fail the build, not ship an empty example.
    if (!fileName.startsWith("~/") || rest.trim() !== "") {
      throw new Error(`Unsupported snippet include: ${line.trim()}`)
    }

    return extractRegion(readSource(fileName.slice(2)), region, fileName)
  })

  return applyCuts(lines)
    .filter((line) => !twoslashDirectivePattern.test(line))
    .join("\n")
    .replace(/\n+$/, "")
}

/** Drops what Twoslash hides: lines above a `---cut---`, below a `---cut-after---`. */
function applyCuts(lines: string[]) {
  const cuts = lines.map((line) => {
    const match = line.match(cutPattern)
    return match === null ? null : (match[1] ?? "-before")
  })
  const start = cuts.lastIndexOf("-before")
  const end = cuts.indexOf("-after")

  return lines.slice(start + 1, end === -1 ? undefined : end)
}

function extractRegion(
  source: string,
  region: string | undefined,
  fileName: string,
) {
  const lines: string[] = []
  let inside = region === undefined
  let found = region === undefined

  for (const line of source.split("\n")) {
    const marker = line.match(regionMarkerPattern)

    if (marker === null) {
      if (inside) lines.push(line)
    } else if (marker[2] === region) {
      inside = marker[1] === undefined
      found = true
    }
  }

  if (!found) {
    throw new Error(`Snippet region ${region} not found in ${fileName}`)
  }

  return lines
}

function visitCode(node: MarkdownNode, visit: (node: MarkdownNode) => void) {
  if (node.type === "code") visit(node)
  for (const child of node.children ?? []) visitCode(child, visit)
}
