// The React-free half of the library: manifests, descriptors and the
// resolver are plain data and one pure function, importable from server
// components, Node scripts and tests. The React adapter lives in the root
// "create-slot" entry and re-exports everything here.
export { definePlugin, defineSlot } from "./define"
export { entriesOf, resolvePlugins } from "./resolve"
export type {
  Contribution,
  ContributionSpec,
  Diagnostic,
  ErasedComponent,
  Override,
  PluginDefinition,
  Resolution,
  ResolvedEntry,
  ResolveOptions,
  Slot,
} from "./types"
