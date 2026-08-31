---
status: accepted
---

# One declarative channel, one pure resolver; the runtime channel lives in the façade

4.0 rebuilt the public API around a single idea: the registry is one pure
function over serializable data, and everything else is a thin adapter. The
package split at the only seam that matters — `create-slot/core` is React-free
(descriptors, manifests, `resolvePlugins(plugins, options) -> Resolution`,
`entriesOf`), and `create-slot` is the `"use client"` adapter (`SlotProvider`,
`SlotHost`, `ContributionBoundary`, hooks) plus the source-compatible
`createSlot()` façade.

The runtime channel was exiled into that façade whole: each `createSlot()`
factory owns a private closure store and context, and hosts of the registry
never merge fills. Contribution ids became required; the full id
`${pluginId}/${contributionId}` is the React key, the override address and the
name diagnostics use. The resolver returns diagnostics — never throws, never
drops silently. Applications pass a pre-resolved `Resolution` to the provider,
so memoization is theirs, visibly.

## Considered Options

- **A two-channel registry with identified fills** — rejected. Cross-channel
  index features break SSR determinism: a `max`-style rule over the merged
  list lets a late client fill displace a declared contribution already
  present in the server's HTML, and fills would need the plugin identity v3
  deliberately never gave them. The channel asymmetry was the root of most of
  v3's incoherence; the split removes the asymmetry instead of managing it.
- **An RSC-first design with a shipped ServerHost entry** — rejected. Mixing
  directive-carrying and plain files in one published entry is build-fragile,
  and the capability costs eight lines of userland: `entriesOf` plus the
  exported `ContributionBoundary` (see `examples/nextjs-app/app/server-nav.tsx`).
- **Keeping `PluginProvider plugins={...}`** — rejected. A provider that
  resolves internally owns a memo keyed on the list, which every inline prop
  threatens; a provider that accepts a `Resolution` has nothing to rebuild.

## Consequences

- The RSC story has two honest tiers and no codegen. Tier 1: manifests and the
  provider live behind one client boundary; ids cross the seam. Tier 2 (the
  two-module discipline): a manifest is a plain module importing components
  from `"use client"` files, so a server component can import it, call
  `resolvePlugins`, and pass the whole Resolution — metadata plus client
  references — across the boundary.
- ADR 0001's freeze thawed: 4.0 is the "clean break" that document declined
  for 3.0. The façade's runtime forms are untouched; its `Slot<Props>` type
  name moved to the descriptor, and the façade component type is
  `RuntimeSlot<Props>`.
- ADR 0002 is superseded for the library: the manifest may now live in a
  shared graph. The CRM's server seam survives for what genuinely cannot
  cross: installed order as ops-config, and per-request state loaders.
- ADR 0003 is superseded in one respect: the provider accepts `Pending` (and
  `Failed`) as component props. The default fallback stays `null`, so the
  streamed shell is unchanged unless the application opts in.
- The deferred ideas in `docs/ideas/` resolve against this decision — each
  file carries its verdict; policies, inspectors and validators are userland
  functions over `Resolution`, which is plain data on purpose.
