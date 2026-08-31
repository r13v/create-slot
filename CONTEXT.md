# create-slot

A React plugin registry: features declare UI contributions, and the application
renders them at named points without importing the features. This glossary fixes
the words the library, its docs and its examples all use for those parts.

## Language

**Slot**: A named extension point that contributions are addressed to. A name
plus a props type, never a component — and since 4.0, literally: `defineSlot`
returns the descriptor this glossary describes, and the `Slot<Props>` type
names it.
_Avoid_: Extension point, mount point, zone

**Host**: The component that renders every contribution to one slot
(`SlotHost`), and whose own children are the placeholder while nothing is
contributed. A slot can have many hosts mounted at once.
_Avoid_: Outlet, target, container, sink

**Contribution**: One piece of UI addressed to a slot. Declared with a required
local id; the full id `${pluginId}/${contributionId}` is its React key, its
override address, and the name diagnostics call it by.
_Avoid_: Extension, widget, item, plugin UI

**Resolution**: The pure, serializable output of `resolvePlugins`: slot name →
sorted entries, plus diagnostics. The thing a provider is given, a validator
inspects, and a server component can hand across the client boundary whole.
_Avoid_: Index, registry snapshot, graph object

**Fill**: The runtime channel's contributor — a façade-only concept since 4.0:
the element a `createSlot()` slot registers while mounted. A declared
contribution is never called a fill.
_Avoid_: Teleport, portal

**Declarative channel**: The registration path where a contribution is manifest
data on a plugin, resolved by `resolvePlugins` — the only channel the registry
has, and the only path a server render can see.
_Avoid_: Static channel, static contributions

**Runtime channel**: The registration path where a fill announces itself from an
effect while a component is mounted, so it never reaches server markup. It
lives entirely inside the `createSlot()` façade: each factory owns a private
store, shared with nothing.
_Avoid_: Dynamic channel, dynamic contributions

**Deferred contribution**: A declared contribution whose component loads in a
later bundle chunk. The manifest that declares it is never deferred.
_Avoid_: Lazy contribution, async contribution, split contribution

**Two-module discipline**: A manifest written as a plain module that imports
its components from `"use client"` files. It is what makes a Resolution
serializable across an RSC boundary — the components cross as client
references — with no build step and no import map.
_Avoid_: Import-map pattern, component paths

**Client boundary**: The `"use client"` module that holds `SlotProvider`.
Under React Server Components either the ids cross it and the client resolves
(tier 1), or — under the two-module discipline — the server resolves and the
Resolution itself crosses (tier 2).
_Avoid_: Client wrapper, hydration boundary, provider shim

**Server seam**: A module carrying what a server must own regardless of the
graph — installed order as ops-config, per-request state loaders: functions
could never cross the boundary anyway. `crm-core/server` is one.
_Avoid_: Server bridge, isomorphic module, shared entry
