# CRM — Next.js, pages router

`examples/crm-core` — the CRM whose features are plugins — rendered on the
server by the Next.js **pages** router. The [app router
example](../nextjs-app) is the same story under RSC, and the [SPA](../spa) is
the same domain built out of `createSlot` alone.

```sh
npm run dev:next-pages     # from the repository root
```

Then open http://localhost:3000 and **view source**.

## What the HTML proves

```
curl -s 'http://localhost:3000/deals?view=stale' | grep 'Needs attention'
```

In the served markup, before any JavaScript runs:

- the plugins' nav items, dashboard cards, deal actions and panels are all there;
- the saved view (`?view=stale`) has already been applied, by a table the app
  resolved from the plugins' manifests;
- the pipeline card shows €400,000 — the target its `preload()` fetched on the
  server, not the client-side default.

And two things are deliberately **not** there:

- the **Status** bar shows its placeholder. It is filled through the runtime
  channel (`createSlot`), which registers from an effect — so it appears after
  hydration, and never in the HTML.
- the **command list** is empty. `setup()` runs in an effect too.

## The whole integration

Three files, and only the router is Next-specific:

| File                                           | What it does                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| [lib/crm-server.ts](lib/crm-server.ts)         | Decides which plugins this request gets, and preloads their state     |
| [pages/\_app.tsx](pages/_app.tsx)              | Resolves the same list on the client and hands the `Resolution` to `SlotProvider` |
| [components/layout.tsx](components/layout.tsx) | The chrome, including the runtime channel's host                      |

Each page is then four lines — `getServerSideProps` plus a shared page
component. See [pages/deals/index.tsx](pages/deals/index.tsx).

## The SSR contract

`create-slot` asks for exactly one thing: **the resolver's inputs must be the
same, in the same order, on the server and on the client** — deep-equal
resolutions produce identical markup.

So the enabled set is data that travels with the HTML, in `pageProps`. Try
`?plugins=pipeline,email` — the response contains fewer contributions, and the
client rebuilds precisely that list. Recomputing it in the browser instead is how
hydration breaks.

## Pages router specifics

- **No streaming.** The pages router renders in one pass, so `Suspense` inside a
  contribution has no chunk to arrive in later; anything a contribution needs is
  loaded in `getServerSideProps` and preloaded into the store. Streaming is worth
  it — see the Streaming section of [REGISTRY.md](../../REGISTRY.md) — and
  [examples/nextjs-app](../nextjs-app) does it.
- **The store is created once**, on the first render, from the state that
  response carried, and kept across client navigations.
- **`transpilePackages: ["crm-core"]`** in `next.config.mjs`, because the shared
  CRM is a workspace package of TypeScript sources rather than a published build.
