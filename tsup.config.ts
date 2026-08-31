import { defineConfig } from "tsup"

/**
 * One config, two entries: splitting keeps a single copy of every shared
 * module across both — a second config would duplicate them, and a duplicated
 * store is the v3 CJS footgun this build exists to rule out.
 *
 * No `banner`: it would land on every output file, chunks and the React-free
 * core included, and in CJS it lands after the "use strict" preamble where a
 * directive is inert. The client entry gets its "use client" prepended by
 * scripts/prepend-use-client.mjs after the build — which is also why
 * sourcemaps are off: a post-build prepend would shift every mapping by one
 * line.
 */
export default defineConfig({
  entry: {
    index: "lib/index.ts",
    "core/index": "lib/core/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  clean: true,
  sourcemap: false,
  external: ["react"],
})
