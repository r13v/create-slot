import assert from "node:assert/strict"
import { test } from "node:test"
import { rewriteSiteLinks } from "../../scripts/build-agent-docs.mjs"
import { prefixMarkdownLinks } from "../../scripts/fix-vocs-llms-links.mjs"
import { prefixSitemapUrl } from "../../scripts/fix-vocs-sitemap.mjs"
import { fixSkipLinks } from "../../scripts/fix-vocs-skip-links.mjs"
import { resolveIncludes } from "../src/lib/markdown-includes.ts"

const basePath = "/create-slot"
const siteUrl = "https://r13v.github.io/create-slot"
const snippet = [
  "// @jsx: react-jsx",
  '"use client"',
  "// [!region prelude]",
  'import { createSlot } from "create-slot"',
  "// [!endregion prelude]",
  "// [!region host]",
  "export const Menu = createSlot()",
  "// @ts-expect-error: the host takes no children",
  "// [!endregion host]",
].join("\n")
const read = (fileName) => {
  assert.equal(fileName, "snippets/menu.tsx")
  return snippet
}

test("an include resolves to its region without Twoslash directives", () => {
  assert.equal(
    resolveIncludes("// [!include ~/snippets/menu.tsx:host]", read),
    [
      "export const Menu = createSlot()",
      "// @ts-expect-error: the host takes no children",
    ].join("\n"),
  )
  assert.equal(
    resolveIncludes("// [!include ~/snippets/menu.tsx]\n//   ^?", read),
    [
      '"use client"',
      'import { createSlot } from "create-slot"',
      "export const Menu = createSlot()",
      "// @ts-expect-error: the host takes no children",
    ].join("\n"),
  )
})

test("the code that Twoslash cuts stays out of the Markdown", () => {
  const code = [
    "// [!include ~/snippets/menu.tsx:prelude]",
    "// ---cut---",
    "// [!include ~/snippets/menu.tsx:host]",
    "// ---cut-after---",
    "Menu satisfies unknown",
  ].join("\n")

  assert.equal(
    resolveIncludes(code, read),
    [
      "export const Menu = createSlot()",
      "// @ts-expect-error: the host takes no children",
    ].join("\n"),
  )
})

test("an include that does not resolve fails the build", () => {
  assert.throws(
    () => resolveIncludes("// [!include ~/snippets/menu.tsx:missing]", read),
    /region missing not found/,
  )
  assert.throws(
    () => resolveIncludes("// [!include ~/snippets/menu.tsx /a/b/]", read),
    /Unsupported snippet include/,
  )
})

test("package docs link to pages relatively and to everything else on the site", () => {
  const context = {
    basePath,
    pages: new Set(["index.md", "get-started.md", "guides/ordering.md"]),
    siteUrl,
  }
  const markdown = [
    "See [Get started](/create-slot/get-started#install) and [home](/create-slot/).",
    '<a href="/create-slot/ordering-demo">Demo</a> and [external](https://example.com/x).',
    "`[inline](/create-slot/get-started)`",
    "```md",
    "[code](/create-slot/get-started)",
    "```",
  ].join("\n")

  assert.equal(
    rewriteSiteLinks(markdown, "guides/ordering.md", context),
    [
      "See [Get started](../get-started.md#install) and [home](../index.md).",
      `<a href="${siteUrl}/ordering-demo">Demo</a> and [external](https://example.com/x).`,
      "`[inline](/create-slot/get-started)`",
      "```md",
      "[code](/create-slot/get-started)",
      "```",
    ].join("\n"),
  )
})

test("LLM file links get the base path outside code", () => {
  assert.equal(
    prefixMarkdownLinks(
      "- [Overview](/index.md): x\n[API](/api#slot) `[no](/api)`\n```\n[no](/api)\n```",
      basePath,
    ),
    "- [Overview](/create-slot/index.md): x\n[API](/create-slot/api#slot) `[no](/api)`\n```\n[no](/api)\n```",
  )
  assert.equal(prefixMarkdownLinks("[API](/api)", "/"), "[API](/api)")
})

test("sitemap URLs and the skip link get the base path once", () => {
  for (const [input, expected] of [
    ["https://r13v.github.io/", "https://r13v.github.io/create-slot/"],
    ["https://r13v.github.io/api", "https://r13v.github.io/create-slot/api"],
    [
      "https://r13v.github.io/create-slot/api",
      "https://r13v.github.io/create-slot/api",
    ],
  ]) {
    assert.equal(prefixSitemapUrl(input, basePath), expected)
  }

  const html = fixSkipLinks(
    '<a data-v-skip-to-content="true" href="/api#vocs-content">Skip</a></body>',
    basePath,
  )
  assert.match(html, /href="\/create-slot\/api#vocs-content"/)
  assert.equal(fixSkipLinks(html, basePath), html)
})
