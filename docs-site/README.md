# docs-site

The documentation site for `create-slot`, built with [vocs](https://vocs.dev)
and deployed to GitHub Pages by
[`.github/workflows/pages.yml`](../.github/workflows/pages.yml).

```sh
npm run site:dev        # from the repo root: bundles the package, then serves on :5174
npm run site:build      # bundles the package, then builds to docs-site/dist/public
npm run site:typecheck  # tsc over the config, the snippets and the demos
```

This is a **separate npm project**, not a workspace: it has its own lockfile and
depends on the package under test through `"create-slot": "file:.."`. So the
package has to be bundled before the site is built — `site:dev` and `site:build`
both do it, and the workflows run `npm run bundle` first.

## Layout

| path | what it holds |
| --- | --- |
| `vocs.config.ts` | sidebar, branding, twoslash options |
| `src/pages/*.mdx` | one file per route |
| `src/pages/_root.css` | styling for the live demos only |
| `src/snippets/*.tsx` | every code sample on the site |
| `src/components/*.tsx` | the live demos |

## Snippets are real, type-checked files

No code sample is written inline in MDX. Each one lives in `src/snippets`, is
compiled by `npm run site:typecheck`, and is pulled into a page by region:

````md
```tsx twoslash
// [!include ~/snippets/quick-start.tsx:prelude]
// ---cut---
// [!include ~/snippets/quick-start.tsx:host]
```
````

Two conventions make that work:

- **Every snippet has a `prelude` region** holding its imports, shared slots and
  ambient stubs. A fence includes it first, then `// ---cut---` to hide it, then
  the region it actually shows. A `prelude` must never depend on a region, or
  the fences that hide it will not compile.
- **No `^?` inside a snippet file.** Twoslash rejects a type query that lands in
  a hidden range, and every region is hidden by some fence. Put the query in the
  MDX instead, on the line after an include whose region ends with the
  declaration you want to annotate.

Twoslash failures fail the build, so a sample cannot drift from the package.

### The one exception: `@errors` samples

A sample that demonstrates a **type error** cannot live in `src/snippets` —
`npm run site:typecheck` compiles that directory, and the sample's whole point
is that it does not compile. Those fences are written inline in the MDX with a
`// @errors: <code>` directive:

````md
```tsx twoslash
// @errors: 2322
import { defineSlot } from "create-slot"

const StatusBar = defineSlot("status-bar")
// ---cut---
export function Shell() {
  return <StatusBar.Host label="Ready" />
}
```
````

They are still checked, just by a different gate: twoslash fails the build if
the listed code is not raised, or if the fence raises a code that is not listed.
Verify a code with `tsc` before writing it down rather than guessing.

Inline fences are allowed **only** for this. Everything that compiles belongs in
`src/snippets`. `grep -L '\[!include' ` over the fences of a page is the check.

## Live demos

Vocs renders pages as server components, so a demo is two files: a
`"use client"` module with the actual demo, and a thin wrapper that also carries
a `toMarkdown()` fallback for the `llms.txt` output. See
`src/components/slot-basics-demo.tsx`.

## Pinned dependencies

`waku` is pinned to `1.0.0-beta.6`. Vocs 2.x reads `router.unstable_events` in
`ScrollRestoration`, and beta.9 removed it — the site builds fine, then throws
`Cannot read properties of undefined (reading 'on')` during hydration and
renders a blank page. Upgrade only after checking that vocs still agrees with
waku's router API.

`vocs.config.ts` must not import `typescript`. Doing so bundles the whole
compiler into the built config, and `vocs preview` then crashes on `__filename`
in ESM scope. The one compiler option the site needs is written as a literal.

## Base path

Both workflows build with `BASE_PATH=/create-slot` and
`BASE_URL=https://r13v.github.io`. Locally the site builds at `/`, so
root-relative asset URLs resolve against the production `baseUrl` and 404 — pass
`BASE_URL=http://127.0.0.1:<port>` when previewing the built output.
