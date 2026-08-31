# The registry

The registry is `create-slot`'s declarative channel — since 4.0, its only
channel. Plugins declare their contributions as data; `resolvePlugins` turns
the plugin list into a `Resolution` — one pure, synchronous, deterministic
function; hosts render what it resolved. The registry therefore renders on the
server, and the resolved graph itself can cross an RSC boundary.

A contribution is not an element that an effect moves at runtime. A
contribution is **data plus a component**, under a required id.

```tsx
// slots.ts — pure data, importable from server modules
export const NavMenu = defineSlot<{ current: string }>("nav-menu")

// plugins/pricing.tsx
export const pricing = definePlugin({
  id: "pricing",
  contributes: [
    NavMenu.contribute("nav-item", { order: 10, component: PricingNavItem }),
  ],
})

function PricingNavItem({ current }: { current: string }) {
  const session = useSession() // an ordinary component: hooks and context work
  if (!session.canSeePricing) return null // this is how you control visibility
  return <li>Pricing {current === "/pricing" && "(current)"}</li>
}

// app — the application owns the resolution, and the memo boundary with it
const resolution = resolvePlugins([pricing, billing], {
  disable: { contributions: ["billing/beta-banner"] },
  overrides: [NavMenu.override("pricing/nav-item", { order: 5 })],
})

;<SlotProvider resolution={resolution} onError={report} Failed={PluginError}>
  <ul>
    <SlotHost slot={NavMenu} props={{ current: route }} />
  </ul>
</SlotProvider>
```

There is a second channel for a contribution that you cannot know in advance —
the runtime channel — and it lives entirely inside the `createSlot()` façade.
The registry never merges it.

## The two entry points

| entry              | contents                                                        | graph        |
| ------------------ | --------------------------------------------------------------- | ------------ |
| `create-slot/core` | `defineSlot`, `definePlugin`, `resolvePlugins`, `entriesOf`     | React-free   |
| `create-slot`      | everything above, plus `SlotProvider`, `SlotHost`, `ContributionBoundary`, hooks, `createSlot` | `"use client"` |

`create-slot/core` never imports React at runtime, so a server component, a
Node script or a test can import it under any condition — CI proves it with
`npm run test:rsc`. The root entry re-exports the core, so a client module
needs one import.

## The API

```ts
// core
defineSlot<Props>(name): Slot<Props>            // { name, contribute, override }
definePlugin(definition)                        // { id, contributes? } plus your own fields
resolvePlugins(plugins, options?): Resolution   // { slots, diagnostics }
entriesOf(resolution, slot): ResolvedEntry<Props>[]

// adapter
<SlotProvider resolution onError? Failed? Pending? />
<SlotHost slot props? renderEntries?>placeholder</SlotHost>
useSlotProps(slot): Props | null
useContribution(): { slot, pluginId, contributionId }
<ContributionBoundary pluginId contributionId slot />

// façade — SPA-only, source-compatible with 2.x/3.x
createSlot<Props>(): RuntimeSlot<Props>
```

The library reads two fields of a manifest: `id` and `contributes`.

A contribution's id is local to its plugin, never contains `/`, and must be
unique inside it. The full id `${pluginId}/${contributionId}` is the React key
every host uses, the address `disable` and `override` target, and the name
diagnostics use. Because the key is the id, inserting or removing a
neighbouring contribution never remounts the others — the v3 rule about
fixed-shape `contributes` arrays is gone.

`useContribution` returns the identity of the contribution rendering now:
slot, plugin id, contribution id. Only the library knows these values while a
contribution renders. Use them to give each plugin a store, a prefixed logger,
a settings namespace, or a telemetry tag.

`SlotHost` renders its own children while no plugin contributes to the slot.
`props` is an explicit bag, not a spread — so the host's own props can never
collide with a slot's, and `children` structurally cannot leak into a
contribution.

## The resolver

`resolvePlugins` is where everything that used to be render-time work
happens: grouping, `disable`, `override` patches, sorting
(`order`, then plugin position, then declaration position), key minting.
Problems come back as **diagnostics** — never thrown, never silently dropped:

```
duplicate-plugin-id · duplicate-contribution-id · invalid-contribution-id
unknown-disable-target · unknown-override-target · override-slot-mismatch
```

In development the provider prints them once per content change; a production
build pays nothing for the printing, and the data is still on the Resolution
for the application to assert on:

```ts
expect(resolvePlugins(PLUGINS).diagnostics).toEqual([])
```

That one line in a test is the catalog validator. The Resolution is plain
data — slot name → sorted entries plus the diagnostics — so an inspector, a
policy check or a snapshot is a `.map` over it, not a library feature.

Typed overrides come from the slot, not from a string: a string id cannot
carry `Props`, so `NavMenu.override(target, { component })` is where the
replacement component is type-checked.

## The SSR contract

**Give the resolver the same inputs, in the same order, on the server and on
the client.** Deep-equal resolutions produce identical markup; nothing depends
on object identity across the seam.

If a tenant, a user or a flag controls the enabled set, that set is data. Send
it with the HTML and resolve from it on both sides — or resolve once on the
server and send the Resolution itself (see React Server Components below). If
you compute the set again on the client from something the server did not see,
hydration breaks. `lib/ssr.test.tsx` tests both directions.

## The cost of a re-render

A host re-renders when a component above it re-renders. The host gives each
contribution the props it received. Without protection, a state change in one
feature re-renders all the others.

The host therefore compares, twice. It keeps its own props stable while their
values stay the same, and it compares each resolved entry **by content** — id,
rank, component identity — because `resolvePlugins` mints fresh entry objects
on every call and an application is allowed to call it inline on every render.
The result, held as budgets in `lib/perf.test.tsx`:

- inline `onError`/`Failed`/`Pending` on the provider re-render nothing below
  the thin boundary shells;
- an inline `resolvePlugins()` per render re-renders hosts and shells, and no
  contribution renders, remounts or commits anything.

Hold the Resolution in a module or a `useMemo` anyway — it is one line, and it
spares the hosts too. Pass props by value when you can: `zoom={1}` is cheap to
compare; `style={{ zoom }}` is a new object each time and counts as a change,
as it would for `memo`.

## React Server Components

Two tiers, both without codegen. `examples/nextjs-app` ships the second.

**Tier 1 — the client boundary.** Manifests and `SlotProvider` live behind one
`"use client"` module; a server component sends **ids**, and the client
resolves. This is the v3 shape, and it remains correct and simple.

**Tier 2 — the two-module discipline.** Write each manifest as a plain module
that imports its components from `"use client"` files. Then the manifest —
and `resolvePlugins` over it — is importable from a server component, and the
Resolution it returns is serializable: metadata plus client references. The
server resolves once and passes the whole graph across the boundary as a prop.

```tsx
// app/layout.tsx — a server component
const resolution = resolvePlugins(enabledPlugins(enabled))
return <Providers resolution={resolution}>{children}</Providers>
```

A fully server-rendered host is then eight lines of userland — `entriesOf`
plus the exported `ContributionBoundary`, which ships as `"use client"` so the
failure semantics stay the host's (`examples/nextjs-app/app/server-nav.tsx`):

```tsx
const entries = entriesOf(resolution, NavItems)
return entries.map((entry) => {
  const Item = entry.component // typed by the slot — no cast
  return (
    <ContributionBoundary key={entry.key} {...identityOf(entry)}>
      <Item current="/" />
    </ContributionBoundary>
  )
})
```

The hard walls, stated plainly: `useSlotProps` is context and therefore
client-only — a server host passes serializable props directly; functions
(reducers, `setup`, loaders) never cross the boundary, so the seam that
carries them (`crm-core/server`) survives; and a component defined inside the
manifest module itself is not a client reference and will not cross.

## Failure isolation

Every contribution renders inside `ContributionBoundary`: contribution
identity, an error boundary, and a `Suspense` boundary.

On the client, the error boundary catches. `Failed` — a component, so its
identity is stable and it crosses an RSC boundary — renders in place of the
contribution with `{ pluginId, contributionId, slot, error, reset }` as props;
`onError` reports. There is no automatic reset: a reset on element identity
loops, because a host that re-renders in response to `onError` creates a new
element each time. To recover, call the `reset` you were given.

On the server, `getDerivedStateFromError` does not run, but the `Suspense`
boundary still works: React marks that one boundary for a client render
(`<!--$!-->` in the HTML) and keeps the remaining markup. One broken
contribution costs its own line, not the page. `lib/ssr.test.tsx` and
`lib/streaming.test.tsx` verify both halves.

`Pending` fills the same `Suspense` while a deferred contribution loads. Unset
it and the fallback is `null`, byte-for-byte the v3 shell. Set it knowing the
trade: the skeleton ships in the streamed shell and React swaps it out — HTML
size and layout shift for earlier paint.

## Streaming

`renderToPipeableStream` needs nothing more from the library. The `Suspense`
boundary around each contribution makes streaming useful: a slow contribution
delays its own line only; the shell goes out immediately with every other
contribution in it, and the resolved content arrives in a later chunk with
React's own `$RC` swap.

Note this risk before you stream: **a state update during hydration destroys
streamed HTML.** An application's `setup` loop registers commands in an
effect, which runs while the page still hydrates. Wrap that registration in
`startTransition` — `examples/crm-core/src/runtime.tsx` does, and says why.

## What the library does not do

**No `when` predicate.** Visibility has one mechanism: the contribution
returns `null`. A host renders its children when no plugin *contributes*,
which is not the same condition as "nothing is visible". Use CSS for the
visual case: `ul:empty::before { content: "no items" }`.

**No policies beyond `disable`.** Limits, allowlists and caps over the
resolved graph are a `.filter` over `Resolution.slots` the application writes
with its own vocabulary — and a cross-channel cap was rejected outright: a
late client fill displacing markup the server already shipped is the class of
bug this design exists to make unrepresentable (ADR 0004).

**No exclusive slots and no routing.** "Exactly one owner" is a table the
application resolves from data before render — `resolveViews` in
`examples/crm-core/src/runtime.tsx` does it in 15 lines and reports who was
refused.

**No inventory helper.** The manifest *is* data; `describeCatalog` in
`examples/crm-core/src/catalog.ts` is a `.map` over an array the application
owns.

**No state, no lifecycle and no command registry.** The library knows who
contributes what, in what order, and what occurs when a contribution breaks.
The application owns everything else. The manifest is open data:

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

`examples/crm-core` demonstrates both. Both follow one rule: **assemble the
state from the catalog before render. Do not inject it in an effect.**

- **redux** — a plugin declares `reducer` and `preload`. The application
  combines slices from the whole catalog (a store whose shape depends on a
  toggle cannot be preloaded), the server sends the loaded state with the
  HTML. The `pipeline` and `email` plugins do this.
- **mobx** — a plugin declares `createStore`; one instance per application
  instance, one per request on the server. A contribution reaches its own
  store through `useContribution().pluginId`. The `telephony` plugin keeps a
  live call there — ephemeral, client-only, nothing to serialise.

## The relationship to `createSlot`

`createSlot()` is the runtime channel, whole and alone: a factory whose slot
component registers its child while mounted, whose `Host` renders the fills,
and whose `useProps` reads the host's props from a fill. Each factory owns a
private store — two factories can never exchange fills, two React roots using
one factory always do, and no module-level registry exists for a duplicated
package copy to split.

Choose by what a contribution *is*:

- **`contribute` — data plus a component.** The host enumerates it during
  render, so it is in the HTML, addressable by id, disable-able and
  override-able. The cost: one plugin's contributions no longer share a React
  subtree, so a store takes the place of shared `useState`.
- **a façade fill — an element from the position where it is mounted.** A
  feature stays one subtree and shares ordinary state. The cost: no SSR, no
  identity, no isolation — it is the application's own code in the
  application's own tree.

Use the registry for content that must be in the HTML. Use the façade for
chrome that depends on live tree state — a status bar fed by whichever page is
mounted.

## Examples

The examples are one CRM whose features are plugins. The registry's own
examples are the two Next.js shells over `examples/crm-core`; the SPA is the
façade alone and contains none of the registry.

```sh
npm run dev:spa        # http://localhost:5173 — client-rendered, createSlot only
npm run dev:next-pages # http://localhost:3000 — Next.js pages router, SSR
npm run dev:next-app   # http://localhost:3001 — app router: RSC tier 2 + streaming
```

Run `npm run dev:next-pages`, then view the source at
`http://localhost:3000/deals?view=stale`: the plugins' nav items, actions and
panels are in the markup, the saved view is applied, and the pipeline card
carries its preloaded target. The status bar shows its placeholder (façade
channel) and the command list is empty (`setup` runs in an effect) — both
appear after hydration.

`npm run dev:next-app` adds the two things only the app router raises: the
Resolution resolved in a server layout and handed across the boundary whole,
and a dashboard card whose data streams in after the shell. Its sidebar also
carries a host with no client half at all — `app/server-nav.tsx`.
