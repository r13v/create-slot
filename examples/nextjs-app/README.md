# CRM — Next.js, app router

The same CRM as the [pages router example](../nextjs-pages) — the same plugins,
the same pages — rendered by React Server Components, and **streamed**.

```sh
npm run dev:next-app     # from the repository root
```

Then open http://localhost:3001 and **view source**.

## What this example is for

The pages router example proves the declarative channel reaches the HTML. This
one is about the two things only the app router raises:

- a plugin manifest is client-side code, and RSC draws a hard line through the
  application because of it;
- a slow contribution can hold up its own line and nothing else.

## The line RSC draws

`defineSlot` calls `createContext`, and the `react-server` build of React does
not export `createContext`. So **the manifest lives in the client graph** — the
catalog, the slots, every plugin — and a server component that imports
`crm-core` does not compile.

Nothing crosses the boundary but data:

| File                                                 | Graph  | What it does                                                                    |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| [app/layout.tsx](app/layout.tsx)                     | server | Decides the request: which plugins, their state, and the one slow query         |
| [lib/crm-server.ts](lib/crm-server.ts)               | server | `next/headers`, `crm-core/server` — the half of the CRM a server may read       |
| [components/crm-shell.tsx](components/crm-shell.tsx) | client | `"use client"`. Imports the manifests itself and hands them to `PluginProvider` |
| [lib/crm-pages.ts](lib/crm-pages.ts)                 | client | `"use client"` re-export, so a server route may render the shared pages         |
| [lib/crm-request.ts](lib/crm-request.ts)             | both   | The header name and the installed ids — the only facts both sides need          |

The rule that falls out of it: **the server sends ids, the client owns
manifests.** A component or a function cannot be a prop of a server component, so
`enabled: string[]` travels and `CRM_PLUGINS` stays where it was imported. The
SSR contract is unchanged — the same list, in the same order, on both sides — it
is just expressed in the only currency RSC has.

`crm-core/server` exists for the same reason. `preloadCrmState` used to sit next
to the store in `crm-core/runtime.tsx`; that module reaches `react-redux`, so a
server component cannot import it. The plugins' server halves now live in
[`pipeline.server.ts`](../crm-core/src/plugins/pipeline.server.ts) and
[`email.server.ts`](../crm-core/src/plugins/email.server.ts), and the manifest
points at them.

## Streaming

The **Quarter attainment** card comes from this example's own plugin,
[plugins/insights.tsx](plugins/insights.tsx). Its number takes 1.2 seconds to
load, and nothing waits for it: the layout starts the query and passes the
_promise_, the card reads it with `use()`, and the `Suspense` boundary the host
already puts around every contribution turns that into one hole in the first
chunk.

```sh
curl -N -s --max-time 0.9 http://localhost:3001/ | grep -c 'asking the warehouse'   # 1
curl -N -s --max-time 0.9 http://localhost:3001/ | grep -c '780,000'                # 0
curl -N -s http://localhost:3001/ | grep -c '780,000'                               # 1
```

Every other contribution — nav items, the other three dashboard cards, deal
actions, panels — is in that first chunk. One plugin's slow query costs one card,
and React swaps it in later with its own `$RC` script.

The contribution brings its own fallback. The library's boundary uses `null`,
because it has no `pending` prop to guess with.

## What the HTML proves

```sh
curl -s 'http://localhost:3001/deals?view=stale' | grep 'Needs attention'
```

Before any JavaScript runs, the served markup has the plugins' nav items,
dashboard cards, deal actions and panels; the saved view (`?view=stale`) has
already been applied by a table the app resolved from the plugins' manifests; and
the pipeline card carries €400,000, the target its `preload` fetched on the
server rather than the client-side default.

Deliberately **not** there: the **Status** bar shows its placeholder, because
`createSlot` registers from an effect, and the **command list** is empty, because
`setup` runs in one too.

## Why there is a proxy

A layout is never given `searchParams` — only pages are. The provider belongs in
the layout, because that is what keeps one store alive across client navigations,
so the per-request decision has to reach the layout some other way:
[proxy.ts](proxy.ts) reads `?plugins=` and puts it in a header — `proxy.ts` being
Next 16's name for what used to be `middleware.ts`. A real tenant, licence or flag
lookup would arrive the same way.

Try `?plugins=pipeline,email`: fewer contributions in the response, and the
client rebuilds precisely that list.

The store surviving navigation is the part worth checking by hand — set a
quarterly target on **Settings**, then click **Dashboard**: the Stages card keeps
it, because the client shell never unmounted.

## Two things to know before copying this

- **One React version per build.** The app router runs on the React that Next
  vendors, not on the one in `package.json`, and `use()` comes from there. What
  still matters is that the repository resolves a single React: `crm-core` and
  `create-slot` are symlinked workspace packages, so they resolve React from the
  root, and a _different_ major installed in this workspace alone would put two
  copies in one build — elements made by one are unrecognisable to the other,
  which surfaces as React error #31 during prerendering.
- **`transpilePackages: ["crm-core"]`**, because the shared CRM is a workspace
  package of TypeScript sources rather than a published build.
