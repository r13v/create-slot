// Both entries in one CJS process must resolve to ONE copy of the shared
// modules — the v3 dual-store class of defect, ruled out by construction and
// re-checked here against the actual build output.
const client = require("create-slot")
const core = require("create-slot/core")

if (!Object.is(client.resolvePlugins, core.resolvePlugins)) {
  console.error(
    "create-slot and create-slot/core hold two copies of resolvePlugins — chunks are not shared",
  )
  process.exit(1)
}

console.log("chunk sharing smoke: ok")
