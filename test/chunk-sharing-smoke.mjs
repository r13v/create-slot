// Both entries must resolve to ONE copy of the shared modules — the v3
// dual-store class of defect, ruled out by `splitting: true` and re-checked
// here against the actual build output.
//
// Once per module system, because they are built separately and only the
// within-format identity is a promise the package can keep: ESM is what
// bundlers take, CJS is what `require` takes, and the two formats are
// different instances by construction in any dual-published package.
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

const checks = [
  ["esm", await import("create-slot"), await import("create-slot/core")],
  ["cjs", require("create-slot"), require("create-slot/core")],
]

for (const [format, client, core] of checks) {
  if (typeof core.resolvePlugins !== "function") {
    console.error(`${format}: create-slot/core exports no resolvePlugins`)
    process.exit(1)
  }

  if (!Object.is(client.resolvePlugins, core.resolvePlugins)) {
    console.error(
      `${format}: create-slot and create-slot/core hold two copies of resolvePlugins — chunks are not shared`,
    )
    process.exit(1)
  }
}

console.log("chunk sharing smoke: ok (esm, cjs)")
