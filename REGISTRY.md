# The registry

The registry is `create-slot`'s declarative channel. Plugins declare their
contributions as data, so a host can enumerate them during render. The registry
therefore renders on the server. The package exports all of it from one entry
point, together with `createSlot`.

A contribution is not an element that an effect moves at runtime. A contribution
is **data plus a component**.

```tsx
// slots.ts
export const NavMenu = defineSlot<{ current: string }>("nav-menu")

// plugins/pricing.tsx
export const pricing = definePlugin({
  id: "pricing",
  contributes: [NavMenu.contribute({ order: 10, component: PricingNavItem })],
})

function PricingNavItem({ current }: { current: string }) {
  const session = useSession() // an ordinary component: hooks and context work
  if (!session.canSeePricing) return null // this is how you control visibility
  return <li>Pricing {current === "/pricing" && "(current)"}</li>
}

// app
;<PluginProvider
  plugins={enabledPlugins}
  onError={report}
  renderFailed={renderPluginError}
>
  <ul>
    <NavMenu.Host current={route} />
  </ul>
</PluginProvider>
```

There is a second channel, `Fill`, for a contribution that you cannot know in
advance. `create-slot` is a façade over that channel.

## The API

```ts
defineSlot<Props>(name): SlotDefinition<Props>   // { name, Host, Fill, contribute, useProps }
definePlugin(definition): Plugin       // { id, contributes? } plus your own fields
<PluginProvider plugins onError? renderFailed? />
usePluginId(): string
```

The library reads two fields of a manifest: `id` and `contributes`.

`usePluginId` returns the id of the plugin whose contribution renders now. Only
the library knows this value. Use it to give each plugin a store, a prefixed
logger, a settings namespace, or a telemetry tag.

A slot has five members. They divide by channel:

| member       | channel     | server-rendered |
| ------------ | ----------- | --------------- |
| `contribute` | declarative | yes             |
| `Fill`       | runtime     | no              |
| `Host`       | both        | —               |
| `useProps`   | both        | —               |
| `name`       | —           | —               |

`Host` renders its own children while no plugin contributes to the slot. This
gives a slot a placeholder without more API. `children` belongs to the host, not
to `Props`. The host never forwards `children` to a contribution.

## The runtime channel

```tsx
<NavMenu.Fill order={10}>
  <li>Only knowable at runtime</li>
</NavMenu.Fill>
```

`Fill` renders nothing at its own position. While it stays mounted, it registers
its element into the slot. Each mounted host for that slot then renders the
element. The host ranks the element against the declared contributions. If the
`order` values are equal, the declared contribution wins, because the server
already shipped that position.

React creates the element where you write the `Fill`, but the host renders it.
The element therefore reads the host's props with `useProps()`, not as props.
`Fill` reads `order` and the element's React key one time, at mount. If you
change `order` later, the fill keeps its position. If you change the content,
React reconciles the content and does not remount it.

The runtime channel is the second choice for two reasons:

- **You cannot render it on the server.** Registration occurs in an effect. This
  is the only correct moment, because the host renders before a fill elsewhere
  in the tree can announce itself. Server markup shows the host's placeholder.
  The fill appears after hydration.
- **A module-level store holds the fills**, keyed by slot name. The provider does
  not hold them. This is safe because nothing on the server reads this store, so
  two concurrent server renders cannot see each other's registrations. On the
  client there is one store for each page. `create-slot` always worked this way.

No error boundary and no `Suspense` boundary wrap a runtime fill. A fill is your
own code in your own tree, not a third party's contribution. The isolation
applies to third-party contributions only.

## The SSR contract

**Give the same `plugins` array, in the same order, to the server and to the
client.** The library asks for nothing more. It derives everything else from that
array during render.

If a tenant, a user or a flag controls the enabled set, that set is data. Send it
with the HTML. If you compute it again on the client, hydration breaks.
`lib/ssr.test.tsx` tests both directions: identical lists hydrate without a
warning, and a different client list causes a mismatch.

## The cost of a re-render

A host re-renders when a component above it re-renders. The host gives each
contribution the props it received. Without protection, a state change in one
feature re-renders all the others. For example, a toolbar with 100 contributions
would render all 100 because a keystroke went to a search box next to it.

The host therefore compares. It keeps its own props stable while their values
stay the same. It renders each contribution through a memoised view of the
author's component. A host whose props did not change re-renders nothing.
`lib/perf.test.tsx` holds this as a budget. `npm run bench` measures the result:
approximately 5× on a slot with 100 contributions.

The application must do two things:

- **Keep the plugin list stable.** The library groups and ranks the index one
  time for each array identity. `plugins={all.filter(isEnabled)}` written inline
  builds the index again on each render of the provider, and the new index
  re-renders every host of every slot in it. The contributions themselves are
  spared, because the memoised view is cached on your component and the host
  holds its props by value, so those re-renders commit nothing. Hold the list in
  a `useMemo` or in a module.
- **Pass props by value when you can.** `zoom={1}` is cheap to compare.
  `style={{ zoom }}` is a new object each time and counts as a change, as it does
  for `memo`.

`onError` and `renderFailed` are exempt. They live in their own context, which is
read only where the library isolates a contribution. Inline functions there never
reach a host.

A contribution stays plain data. `contribute()` returns the component you gave,
unchanged. The host owns the memoised view and caches it on your component, so a
rebuild of the index never remounts a contribution.

## React Server Components

The registry is client-side code. `defineSlot` creates a context, and
`PluginProvider` uses `useMemo` and `useEffect`. The `react-server` build of
React exports none of these. A plugin manifest, and each module that imports one,
therefore belongs to the client graph. A server component that imports a manifest
does not compile.

This does not prevent server rendering. React still renders client components on
the server, so the declarative channel still reaches the HTML. Two things change:
where you assemble the plugin list, and what can cross the boundary.

- The module that holds `PluginProvider` and the manifests carries `"use client"`
  and imports the catalog.
- A server component sends **ids**, not plugins. A component or a function cannot
  be a prop of a server component.
- Data that the server must read about a plugin, such as a loader or a capability
  key, needs a module that the server graph can import. Keep that module separate
  from the manifest that points to it.

The SSR contract does not change: the same list, in the same order, on both
sides. `examples/nextjs-app` shows the full integration in five files.

## Failure isolation

The host wraps each contribution in an error boundary and a `Suspense` boundary.

On the client, the error boundary catches the error. `renderFailed` renders in
place of the contribution, and `onError` reports the error. There is no automatic
reset. A reset on element identity loops, because a host that re-renders in
response to `onError` creates a new element each time. To recover, call the
`reset()` function that the library gives to `renderFailed`.

On the server, `getDerivedStateFromError` does not run, but the `Suspense`
boundary still works. React marks that one boundary for a client render
(`<!--$!-->` in the HTML) and keeps the remaining markup. The client then renders
that one contribution again, and the class boundary catches the error. One broken
contribution costs its own line, not the page. This applies to `renderToString`
and to `renderToPipeableStream`. `lib/ssr.test.tsx` and `lib/streaming.test.tsx`
verify it.

## Streaming

`renderToPipeableStream` needs nothing more from the library. The `Suspense`
boundary around each contribution makes streaming useful: a slow contribution
delays its own line only. The shell goes out immediately, with each other
contribution and the slow contribution's fallback. The resolved contribution
arrives in a later chunk, with React's own `$RC` swap script.
`lib/streaming.test.tsx` asserts both halves.

The Next.js pages router does not stream, so `examples/nextjs-pages` does not
stream. It loads a contribution's data in `getServerSideProps` and preloads that
data into the store. `examples/nextjs-app` does stream: a contribution reads a
promise that the layout did not await, and its card arrives after the remaining
page.

Note this risk before you stream: **a state update during hydration destroys
streamed HTML.** An application's `setup` loop registers commands in an effect,
which runs while the page still hydrates. If an urgent update reaches a boundary
that has not hydrated, React discards the streamed markup and renders it again on
the client. React reports "This Suspense boundary received an update before it
finished hydrating". To prevent this, wrap the registration in `startTransition`.
`examples/crm-core/src/runtime.tsx` does this for that reason.

## What the library does not do

**No `when` predicate.** Visibility has one mechanism: the contribution returns
`null`. As a result, a host cannot count the contributions that produced
_output_. The host renders its children when no plugin _contributes_, which is
not the same condition. If all contributions return `null`, the host wrappers
emit no DOM, so the container is empty. Use CSS for the visual case:
`ul:empty::before { content: "no items" }`.

**No exclusive slots and no routing.** "Exactly one owner" is a routing problem,
not a slot problem. Keep the claim in the manifest as an application field, and
resolve it into one table before render. `resolveViews` in
`examples/crm-core/src/runtime.tsx` does this in 15 lines for the saved views
that plugins add to the deal list, and reports the plugin that it refused. That
check is stronger than a library check, because the application knows the actual
keys and decides who wins.

**No inventory helper.** The inventory exists because the manifest _is_ data.
`describeCatalog` in `examples/crm-core/src/catalog.ts` is a `.map` over an array
that the application owns. In development, the library checks one property of a
manifest: that plugin ids are unique. An id becomes part of the React key of each
contribution.

**No state, no lifecycle and no command registry.** The library knows who
contributes what, in what order, and what occurs when a contribution breaks. The
application owns everything else. The manifest is open data that the application
can extend with its own fields, such as names and capability keys:

```ts
type CrmPlugin = PluginDefinition & {
  title: string
  description: string
  reducer?: Reducer
  preload?: () => Promise<unknown> | unknown
  createStore?: () => object
  views?: Record<string, DealView>
  setup?: (api: CrmApi) => (() => void) | void
}
```

`definePlugin` is generic over its argument, so these extra fields keep their
types.

## State: redux and mobx

`examples/crm-core` demonstrates both libraries. Both follow one rule: **assemble
the state from the catalog before render. Do not inject it in an effect.** An
effect does not run on the server, so you cannot preload injected state.

- **redux** — a plugin declares `reducer`, and declares `preload` for the
  server-side initial state of that slice. The application combines the slices
  from the catalog, not from the enabled list, because you cannot preload a store
  whose shape depends on a toggle. The server sends the loaded state with the
  HTML, and the client starts from that state. The `pipeline` and `email` plugins
  do this.
- **mobx** — a plugin declares `createStore`. The application creates one
  instance for each application instance, which on the server means one for each
  request. A contribution gets its own store through `usePluginId()`. The
  `telephony` plugin keeps a live call there. That state is ephemeral and
  client-only, and has nothing to serialise.

## The relationship to `create-slot`

`create-slot` is a façade over the runtime channel only. `createSlot()` calls
`defineSlot` with a generated name. `Slot` is `Fill`. `Host` and `useProps` are
the registry's own, and the host's children are the placeholder. The public API
of `create-slot` does not change. This document describes how the library stores,
orders and delivers contributions.

Choose a channel by what a contribution _is_:

- **`contribute` — data plus a component.** The host can enumerate it during
  render, so it is in the HTML. The cost: the contributions of one plugin no
  longer share a React subtree, and therefore no longer share ordinary
  `useState`. A store takes the place of that state, which is why the examples
  show redux and mobx.
- **`Fill` — an element from the position where it is mounted.** A feature stays
  one subtree, and its contributions share ordinary state. The cost: no SSR.

Use the declarative channel for content that must be in the HTML. Use the runtime
channel for chrome that depends on live tree state.

## Examples

The examples are one CRM whose features are plugins. The registry's own examples
are the two Next.js shells over `examples/crm-core`. The SPA uses the other
channel and contains none of the registry.

```sh
npm run dev:spa        # http://localhost:5173 — client-rendered
npm run dev:next-pages # http://localhost:3000 — Next.js pages router, SSR
npm run dev:next-app   # http://localhost:3001 — Next.js app router, RSC + streaming
```

Run `npm run dev:next-pages`, then view the source at
`http://localhost:3000/deals?view=stale`. The markup already contains the
plugins' nav items, deal actions and panels. The application's resolved table has
already applied the saved view, and the pipeline card carries the target that its
`preload` fetched. Two things are absent from that HTML, by design: the status bar
shows its placeholder, because the runtime channel fills it, and the command list
is empty, because `setup` runs in an effect. Both appear shortly after hydration.

`npm run dev:spa` is the same CRM, built from `createSlot` alone. It has no
manifest and no `PluginProvider`, and it mounts plugins as children of the shell,
so a switch that disables one is a branch that stops rendering. It also shows the
cost of the runtime channel: nothing wraps a fill, so its crash-test plugin must
supply its own error boundary.

`npm run dev:next-app` is the app router version. It produces the same HTML, plus
a contribution whose data arrives in a later chunk, and the client boundary that
RSC forces on any plugin registry. See
[examples/nextjs-app](examples/nextjs-app).
