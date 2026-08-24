# create-slot

A React plugin registry: features declare UI contributions, and the application
renders them at named points without importing the features. This glossary fixes
the words the library, its docs and its examples all use for those parts.

## Language

**Slot**: A named extension point that contributions are addressed to. It is a
name plus a props type, never a component.
_Avoid_: Extension point, mount point, zone

**Host**: The component that renders every contribution to one slot, and whose
own children are the placeholder while nothing is contributed. A slot can have
many hosts mounted at once.
_Avoid_: Outlet, target, container, sink

**Contribution**: One piece of UI addressed to a slot, through either channel.
The umbrella term: `contribute()`, `contributes` and the `Contribution` type all
name the same concept.
_Avoid_: Extension, widget, item, plugin UI

**Fill**: The runtime channel's contributor — the `Fill` component, and the verb
for the registration it performs while mounted. Narrower than contribution: a
declared contribution is never called a fill.
_Avoid_: Slot as a contributor (the `create-slot` façade's published name for
its own fill), teleport, portal

**Declarative channel**: The registration path where a contribution is manifest
data on a plugin, resolved during render — the only path a server render can
see.
_Avoid_: Static channel, static contributions

**Runtime channel**: The registration path where a contribution announces itself
from an effect while a component is mounted, so it never reaches server markup.
_Avoid_: Dynamic channel, dynamic contributions

**Client boundary**: The `"use client"` module that holds `PluginProvider` and
imports the manifests. Under React Server Components the registry can live
nowhere else, so a server sends plugin **ids** across it and the client assembles
the plugin list behind it.
_Avoid_: Client wrapper, hydration boundary, provider shim

**Server seam**: A module carrying what a server has to know about a plugin —
its id, its loaders — separate from the manifest that points at it, because the
manifest itself is client-side code. `crm-core/server` is one.
_Avoid_: Server bridge, isomorphic module, shared entry
