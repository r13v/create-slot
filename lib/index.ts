"use client"

export { ContributionBoundary } from "./adapter/boundary"
export { useContribution, useSlotProps } from "./adapter/hooks"
export { type HostEntry, SlotHost, type SlotHostProps } from "./adapter/host"
export {
  type ContributionInfo,
  type SlotError,
  SlotProvider,
  type SlotProviderProps,
} from "./adapter/provider"
// The React half of the library: one provider, one generic host, the
// isolation boundary, and the source-compatible `createSlot()` façade.
// Everything React-free lives in — and is re-exported from — "./core", which
// ships as its own entry ("create-slot/core") importable from server
// components. The directive above is for source consumers; the published
// bundle gets it re-applied post-build, because bundling strips directives.
export {
  type Contribution,
  type ContributionSpec,
  type Diagnostic,
  definePlugin,
  defineSlot,
  type ErasedComponent,
  entriesOf,
  type Override,
  type PluginDefinition,
  type Resolution,
  type ResolvedEntry,
  type ResolveOptions,
  resolvePlugins,
  type Slot,
} from "./core"
export { createSlot, type RuntimeSlot } from "./facade/create-slot"
