// Checks the output of `npm run site:build`. Run it with the BASE_PATH of
// that build: `BASE_PATH=/create-slot npm run test:output`.
import assert from "node:assert/strict"
import { access, readdir, readFile } from "node:fs/promises"
import { test } from "node:test"
import { proseSegments } from "../../scripts/fix-vocs-llms-links.mjs"
import { normalizeBasePath } from "../../scripts/fix-vocs-skip-links.mjs"

const publicRoot = new URL("../dist/public/", import.meta.url)
const packageDocsRoot = new URL("../../dist/docs/", import.meta.url)
const basePath = normalizeBasePath(process.env.BASE_PATH ?? "/")
const pages = (
  await readdir(new URL("../src/pages/", import.meta.url), { recursive: true })
)
  .filter((name) => name.endsWith(".mdx"))
  .map((name) => name.replace(/\.mdx$/, ".md"))
const llmFiles = [
  "llms.txt",
  "llms-full.txt",
  ...pages.map((page) => `assets/md/${page}`),
]

test("LLM files contain the snippet code, not include lines", async () => {
  for (const file of llmFiles) {
    const markdown = await readFile(new URL(file, publicRoot), "utf8")
    assert.doesNotMatch(markdown, /\[!include /, `${file} has an include`)
    assert.doesNotMatch(markdown, /\/\/ ---cut/, `${file} has a Twoslash cut`)
  }

  const getStarted = await readFile(
    new URL("assets/md/get-started.md", publicRoot),
    "utf8",
  )
  assert.match(getStarted, /Menu: createSlot<\{ current: string \}>\(\),/)
  assert.match(getStarted, /<Slots\.Menu\.Host current=\{current\}>/)
})

test("each llms.txt link opens a file of the static site", async () => {
  const llms = await readFile(new URL("llms.txt", publicRoot), "utf8")
  let checked = 0

  for (const [, href] of llms.matchAll(/\]\((\/[^)\s]+)\)/g)) {
    assert.ok(href.startsWith(`${basePath}/`), `${href} has no base path`)
    await access(new URL(href.slice(basePath.length + 1), publicRoot))
    checked++
  }

  assert.equal(checked, pages.length)
})

test("the package documentation indexes each page and links inside itself", async () => {
  const { version } = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  )
  const skill = await readFile(new URL("SKILL.md", packageDocsRoot), "utf8")
  assert.match(skill, new RegExp(`version: "${escapeRegExp(version)}"`))

  const files = (await readdir(packageDocsRoot, { recursive: true })).filter(
    (file) => file.endsWith(".md"),
  )
  for (const page of pages) {
    assert.ok(files.includes(`references/${page}`), `dist/docs lacks ${page}`)
    assert.match(skill, new RegExp(`\\]\\(references/${escapeRegExp(page)}\\)`))
  }

  let checked = 0
  for (const file of files) {
    const markdown = await readFile(new URL(file, packageDocsRoot), "utf8")
    for (const text of proseSegments(markdown)) {
      for (const [, href] of text.matchAll(/(?:\]\(|href=")([^)"\s]+)/g)) {
        if (/^(https?:|mailto:|#)/.test(href)) continue
        // A rooted link resolves against the site, not inside node_modules.
        assert.ok(!href.startsWith("/"), `${file} links to ${href}`)
        await access(
          new URL(href.replace(/[?#].*$/, ""), new URL(file, packageDocsRoot)),
        )
        checked++
      }
    }
  }
  assert.ok(checked > 0, "no relative links were checked")
})

test("the sitemap and robots.txt point under the base path", async () => {
  const sitemap = await readFile(new URL("sitemap.xml", publicRoot), "utf8")
  const robots = await readFile(new URL("robots.txt", publicRoot), "utf8")
  const urls = [
    ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url),
    ...[...robots.matchAll(/^Sitemap: (\S+)/gm)].map(([, url]) => url),
  ]

  assert.ok(urls.length > pages.length)
  for (const url of urls) {
    assert.ok(new URL(url).pathname.startsWith(`${basePath}/`), url)
  }
})

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
