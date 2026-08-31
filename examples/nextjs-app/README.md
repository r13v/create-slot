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

## The line RSC draws — and where v4 moved it

Since create-slot v4 the manifest is server-legible: `defineSlot` is pure data
from `create-slot/core`, and every plugin keeps its components in a
`"use client"` module (the two-module discipline). So the root layout — a
server component — imports the catalog, calls `resolvePlugins`, and hands the
**whole Resolution** across the boundary: metadata plus client references,
all serializable.

| File                                                 | Graph  | What it does                                                                       |
| ---------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| [app/layout.tsx](app/layout.tsx)                     | server | Decides the request, **resolves the slot graph**, starts the one slow query        |
| [app/server-nav.tsx](app/server-nav.tsx)             | server | A host with no client half: `entriesOf` + `ContributionBoundary` over the graph    |
| [lib/crm-server.ts](lib/crm-server.ts)               | server | `next/headers`, `crm-core/server` — per-request state loading                      |
| [lib/catalog.ts](lib/catalog.ts)                     | both   | The installed list: the layout resolves it, the shell assembles the runtime        |
| [components/crm-shell.tsx](components/crm-shell.tsx) | client | `"use client"`. Takes the Resolution as a prop and hands it to `SlotProvider`      |
| [lib/crm-pages.ts](lib/crm-pages.ts)                 | client | `"use client"` re-export, so a server route may render the shared pages           |
| [lib/crm-request.ts](lib/crm-request.ts)             | both   | The header name and the installed ids — the facts every environment needs          |

What still cannot cross are **functions**: reducers, `setup` lifecycles,
per-plugin stores. That is why `enabled: string[]` still travels and the shell
assembles the runtime's plugin list itself — and why `crm-core/server` keeps
the state loaders: `preloadCrmState` runs per request, and a function cannot
be a prop of a server component.

## Streaming

The **Quarter attainment** card comes from this example's own plugin,
[plugins/insights.tsx](plugins/insights.tsx) (manifest) and
[plugins/insights.components.tsx](plugins/insights.components.tsx) (its
client half). Its number takes 1.2 seconds to
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
