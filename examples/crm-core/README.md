# crm-core

The CRM the two Next.js examples run: a deal pipeline whose features are
plugins. It is a workspace package rather than a copy in each app, because that
is the point — the same manifest gets server-rendered by the pages router and
streamed by the app router, and none of it knows which one it is in. The
[SPA](../spa) is the same domain through the other channel, and shares only this
package's data and stylesheet.

The entry points draw the server/client seam. Since create-slot v4 the
manifests are server-legible: `defineSlot` is pure data from
`create-slot/core`, and every plugin keeps its components in a `"use client"`
module (the two-module discipline), so `crm-core/catalog` and
`crm-core/slots` may be imported by a server component — the app router
example resolves the whole slot graph in its root layout. `crm-core` (the
barrel) stays client-side: it carries the runtime, the views and the status
bar. `crm-core/server` holds what the server must own regardless — the
installed order and the per-request state loaders; [`src/server.ts`](src/server.ts)
says why.

## The extension points

[`src/slots.ts`](src/slots.ts) is the whole surface:

| Slot               | Where it renders                                             |
| ------------------ | ------------------------------------------------------------ |
| `crm.nav`          | Under the shell's own links                                  |
| `crm.dashboard`    | The dashboard, which is a heading and this slot              |
| `crm.deal-actions` | One host per row of the deal table, one on the detail page   |
| `crm.deal-panel`   | Sections of the deal detail page                             |
| `crm.settings`     | Sections of the settings page                                |
| `StatusBar`        | The shell's status bar — the façade channel, so client-only ([`src/status-bar.ts`](src/status-bar.ts)) |

## The plugins

| Plugin                                 | What it shows                                                      |
| -------------------------------------- | ------------------------------------------------------------------ |
| [pipeline](src/plugins/pipeline.tsx)   | All five slots, a redux slice, a server `preload()`, a command     |
| [forecast](src/plugins/forecast.tsx)   | The minimum: pure UI over state it does not own, plus a saved view |
| [email](src/plugins/email.tsx)         | Actions and a panel on a record, settings                          |
| [telephony](src/plugins/telephony.tsx) | Ephemeral client-only state in MobX, reached via `useContribution()`   |

## What the library does not do, and who does it instead

`create-slot` knows who contributes what, in what order, and what happens when a
contribution throws. Everything else in a plugin system is the application's, and
[`src/runtime.tsx`](src/runtime.tsx) is all of it: a store assembled from the
catalog, saved views resolved into one table with a report of who was refused, a
command registry, and the `setup` lifecycle.

The rule that file follows is the one that matters for SSR: **assemble from the
manifest before render, never inject in an effect** — an effect does not run on
the server, so anything injected from one cannot be in the HTML.
