import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { posix } from "node:path"
import { pathToFileURL } from "node:url"
import { mapOutsideInlineCode, mapProseLines } from "./fix-vocs-llms-links.mjs"
import { normalizeBasePath } from "./fix-vocs-skip-links.mjs"

const publicRoot = new URL("../docs-site/dist/public/", import.meta.url)
const outputRoot = new URL("../dist/docs/", import.meta.url)
const packageJsonUrl = new URL("../package.json", import.meta.url)
const llmsEntryPattern = /^- \[([^\]]+)\]\(([^)\s]+)\)(?::\s*(.*))?$/

if (isMain()) {
  if (process.argv.includes("--check")) {
    await checkAgentDocs()
  } else {
    await buildAgentDocs(process.env.BASE_PATH ?? "/")
  }
}

/**
 * `prepublishOnly` gate: `npm run bundle` empties `dist`, so only a site build
 * after the last bundle leaves `dist/docs` in the tarball.
 */
export async function checkAgentDocs() {
  const { version } = JSON.parse(await readFile(packageJsonUrl, "utf8"))
  const skill = await readFile(new URL("SKILL.md", outputRoot), "utf8").catch(
    () => "",
  )

  if (!skill.includes(`version: "${version}"`)) {
    throw new Error(
      `dist/docs does not document create-slot ${version}. Run npm run site:build before you publish.`,
    )
  }
}

/**
 * Writes `dist/docs` for the npm package from the Markdown output of the site
 * build: `SKILL.md` indexes the pages of `llms.txt`, and `references/` holds
 * each page. Runs after `fix-vocs-llms-links.mjs`, so site links carry the
 * base path. Links between pages become relative `.md` links that resolve in
 * `node_modules`; other site links become absolute URLs of the homepage.
 */
export async function buildAgentDocs(basePathValue) {
  const basePath = normalizeBasePath(basePathValue)
  const { homepage, version } = JSON.parse(
    await readFile(packageJsonUrl, "utf8"),
  )
  const markdownRoot = new URL("assets/md/", publicRoot)
  const pages = new Set(
    (await readdir(markdownRoot, { recursive: true })).filter((name) =>
      name.endsWith(".md"),
    ),
  )
  const context = { basePath, pages, siteUrl: homepage.replace(/\/$/, "") }

  await rm(outputRoot, { force: true, recursive: true })

  for (const page of pages) {
    const source = await readFile(new URL(page, markdownRoot), "utf8")
    const target = new URL(`references/${page}`, outputRoot)
    await mkdir(new URL(".", target), { recursive: true })
    await writeFile(target, rewriteSiteLinks(source, page, context))
  }

  const llms = await readFile(new URL("llms.txt", publicRoot), "utf8")
  await writeFile(
    new URL("SKILL.md", outputRoot),
    skillIndex(llms, version, context),
  )
}

/**
 * Rewrites the site links outside code in the page `fromPage` (a path in
 * `pages`, such as `guides/ordering.md`).
 */
export function rewriteSiteLinks(markdown, fromPage, context) {
  const linkPattern = new RegExp(
    `(\\]\\(|(?:href|src)=")(${escapeRegExp(context.basePath)}/[^)"\\s]*)`,
    "g",
  )

  return mapProseLines(markdown, (line) =>
    mapOutsideInlineCode(line, (text) =>
      text.replace(linkPattern, (_match, opener, href) => {
        return `${opener}${packageHref(href, fromPage, context)}`
      }),
    ),
  )
}

/** Builds `SKILL.md` from the entries of `llms.txt`. */
function skillIndex(llms, version, context) {
  const entries = llms
    .split("\n")
    .map((line) => line.match(llmsEntryPattern))
    .filter((match) => match !== null)
    .map(([, title, href, description]) => {
      const link = packageHref(href, "SKILL.md", context, "references/")
      return `- [${title}](${link})${description ? `: ${description}` : ""}`
    })

  return `---
name: create-slot-docs
description: Documentation for create-slot ${version}, the version installed in this project. Use when writing, reviewing, or debugging code that uses create-slot.
metadata:
  package: create-slot
  version: "${version}"
---

# create-slot ${version} documentation

These pages are the documentation of the installed \`create-slot\` package. They match its version, and they are the source of truth for its API and behaviour. Read the pages for your task before you write code, and use only documented APIs.

Links between pages are relative. Links to ${context.siteUrl} open what only the site has, such as the live demos.

## Pages

${entries.join("\n")}
`
}

function packageHref(href, fromPage, context, prefix = "") {
  const rest = href.slice(context.basePath.length)
  const suffixStart = rest.search(/[#?]/)
  const path = suffixStart === -1 ? rest : rest.slice(0, suffixStart)
  const fragment = suffixStart === -1 ? "" : rest.slice(suffixStart)
  // `llms.txt` links pages as `/<page>.md`, and the pages link to `/<page>`.
  const route = path.replace(/^\/|\/$/g, "").replace(/\.md$/, "") || "index"
  const page = [`${route}.md`, `${route}/index.md`].find((name) =>
    context.pages.has(name),
  )

  if (page === undefined) {
    return `${context.siteUrl}${path}${fragment}`
  }

  const relative = posix.relative(posix.dirname(fromPage), `${prefix}${page}`)
  return `${relative}${fragment}`
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isMain() {
  return (
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(process.argv[1]).href
  )
}
