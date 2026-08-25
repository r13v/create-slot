---
status: accepted
---

# The host owns the boundary, not the loading

Feature splitting is a main reason to build a plugin architecture, and
`React.lazy` already works on both channels. But the host fixes both of its
`Suspense` boundaries at `fallback={null}`: `lib/slot.tsx:331` for a declared
contribution, and `lib/slot.tsx:109` for a fill. An author who split a feature
had no documented way to show a skeleton.

The library keeps both boundaries at `null` and documents the recipe instead. The
library owns isolation. It does not own loading, and it does not own
presentation.

## Considered Options

- **`load: () => import("./panel")` on `ContributionSpec`** — rejected. This
  option repeats what `React.lazy` and `next/dynamic` already do, and does it
  less well. A loader that does not know the framework cannot register the chunk
  in the Next client manifest, and that registration is why `next/dynamic`
  exists. The `component` field already accepts the result of either function.
- **`fallback` on `ContributionSpec`** — rejected. This option adds convenience,
  not capability. A contribution can wrap itself today:
  `component: (props) => <Suspense fallback={<Skeleton/>}><Panel {...props}/></Suspense>`.
  React creates that arrow function one time, when the module is evaluated, so
  the `WeakMap` in `isolate` and the `memo` wrapper keep their behaviour.
- **`renderPending` on `PluginProvider`, symmetric with `renderFailed`** —
  deferred, not rejected. Of the three API options, only this one adds something
  an application cannot get today. An application cannot set the pending UI of a
  contribution that it did not write.
- **`contribution.preload()` for the server** — rejected. Code that calls a
  preload function must import the manifest. That import puts the code in the
  client graph (ADR 0002), and a server component cannot reach it there. The
  application already holds the loader that it gave to `lazy`, and can await that
  loader itself.

## Consequences

`fallback={null}` is now a documented contract on both boundaries, not an
implementation detail. A later change to that default changes the behaviour of
every application that followed the recipe.

The recipe must carry three measured facts. A reader cannot guess any of them.

- **`renderToString` does not support `Suspense`, so a deferred contribution
  never reaches the HTML.** React marks the boundary for a client render. A
  fallback of the author's own becomes placeholder markup; with no fallback,
  nothing is emitted for that contribution. Awaiting the loader first does not
  help, because `lazy` resolves in a microtask and the render is synchronous. A
  render that does not stream must resolve the module before it builds the
  `plugins` array. `examples/nextjs-pages` is that case.
- **`renderToPipeableStream` works.** The shell carries the skeleton, and the
  body comes in a later chunk.
- **The two channels show different UI while the chunk loads.** A deferred
  contribution makes `entries.length === 1` immediately, so the host skips its
  `children` placeholder and the slot shows nothing. A façade plugin that mounts
  lazily has registered no fill yet, so `entries.length === 0` and the host does
  show the placeholder.

One difference from `renderFailed` remains. An application can replace a
contribution that fails. It cannot replace a contribution that is pending. Add
`renderPending` if that difference becomes a real complaint.
