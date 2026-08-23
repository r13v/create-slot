---
status: accepted
---

# The manifest stays client-side, and the CRM grows a server seam

The app router example needed a server component to preload plugin state, and
could not have one. `defineSlot` creates a context and `PluginProvider` uses
`useMemo` and `useEffect`; React's `react-server` build exports none of the three
(`useMemo` yes, `createContext`, `useContext`, `useState` and `useEffect` no). So
every module that reaches a manifest belongs to the client graph, and
`preloadCrmState` — which sat in `examples/crm-core/src/runtime.tsx`, next to the
redux store — was unreachable from a server component.

The library keeps its client-side registry. The shared CRM gained a second entry
point, `crm-core/server`, holding the plugin ids and the per-request loaders; each
plugin's server half moved into a sibling module (`pipeline.server.ts`,
`email.server.ts`) and its manifest points at it. The catalog is now built from
`CRM_PLUGIN_IDS`, so the order the server hands out is the order the client
rebuilds, declared once.

## Considered Options

- **Make the registry server-compatible** — a registry without context is a
  registry without hosts. The whole point of a host is that it reads an index
  from the tree it is rendered in.
- **Ship `"use client"` in the library's own bundle** — would let a server
  component import `create-slot` and get client references, but makes the entire
  package client-only, `definePlugin` included, and freezes a Next-specific
  directive into a framework-agnostic library. The application's own boundary
  module costs one line and is where the boundary belongs.
- **Duplicate the loaders in the app-router example** — no change to `crm-core`,
  at the price of two sources of truth for what a plugin loads.
- **Drop the server preload from the app-router example** — the cheapest option
  and the one that deletes the proof: the pipeline card would show its
  client-side default instead of the target the server fetched.

## Consequences

A plugin's server-side fields are declared twice: as a manifest field the reader
sees (`preload: loadPipelineState`) and as an entry in the loader map the server
reads (`LOADERS` in `crm-core/src/server.ts`). One implementation, two
references, and adding a plugin with server state means touching both. The
alternative — deriving one from the other — is exactly what RSC forbids.

`CONTEXT.md` gained two words for this, **client boundary** and **server seam**,
because the split now shows up in three examples' worth of file names.
