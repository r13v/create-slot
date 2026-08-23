# crm-core

The CRM the two Next.js examples run: a deal pipeline whose features are
plugins. It is a workspace package rather than a copy in each app, because that
is the point — the same manifest gets server-rendered by the pages router and
streamed by the app router, and none of it knows which one it is in. The
[SPA](../spa) is the same domain through the other channel, and shares only this
package's data and stylesheet.

Two entry points, and the split is not cosmetic. `crm-core` is the manifest and
the UI, so it is client-side code: `defineSlot` creates a context, which the
`react-server` build of React does not have. `crm-core/server` is what a server
component may import — the plugin ids and the per-request state — and
[`src/server.ts`](src/server.ts) says why.

## The extension points

[`src/slots.ts`](src/slots.ts) is the whole surface:

| Slot               | Where it renders                                             |
| ------------------ | ------------------------------------------------------------ |
| `crm:nav`          | Under the shell's own links                                  |
| `crm:dashboard`    | The dashboard, which is a heading and this slot              |
| `crm:deal-actions` | One host per row of the deal table, one on the detail page   |
| `crm:deal-panel`   | Sections of the deal detail page                             |
| `crm:settings`     | Sections of the settings page                                |
| `StatusBar`        | The shell's status bar — the runtime channel, so client-only |

## The plugins

| Plugin                                 | What it shows                                                      |
| -------------------------------------- | ------------------------------------------------------------------ |
| [pipeline](src/plugins/pipeline.tsx)   | All five slots, a redux slice, a server `preload()`, a command     |
| [forecast](src/plugins/forecast.tsx)   | The minimum: pure UI over state it does not own, plus a saved view |
| [email](src/plugins/email.tsx)         | Actions and a panel on a record, settings                          |
| [telephony](src/plugins/telephony.tsx) | Ephemeral client-only state in MobX, reached via `usePluginId()`   |

## What the library does not do, and who does it instead

`create-slot` knows who contributes what, in what order, and what happens when a
contribution throws. Everything else in a plugin system is the application's, and
[`src/runtime.tsx`](src/runtime.tsx) is all of it: a store assembled from the
catalog, saved views resolved into one table with a report of who was refused, a
command registry, and the `setup` lifecycle.

The rule that file follows is the one that matters for SSR: **assemble from the
manifest before render, never inject in an effect** — an effect does not run on
the server, so anything injected from one cannot be in the HTML.
