# CRM — single-page app

A client-rendered CRM whose features are plugins, built out of `createSlot`
alone: no manifest, no plugin array, no `PluginProvider`. A plugin is a
component that contributes, and installing it is mounting it.

```tsx
<AppShell>
  <PipelinePlugin />
  <ForecastPlugin />
  <TelephonyPlugin />
</AppShell>
```

Each of those renders nothing where it sits — it is a set of fills — so the
tree is the registry: `&&` is the enabled flag, unmounting is uninstalling, and
a plugin's state lives in the plugin, because a plugin is just a component.

```sh
npm run dev:spa      # from the repository root
```

Then open http://localhost:5173.

## What to look at

| Thing to try                              | What it demonstrates                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| The **Plugins** checkboxes in the sidebar | Mounting is installing: the branches in [src/app.tsx](src/app.tsx) are the whole lifecycle |
| **Actions** in the deal table             | One host per row plus one on the detail page; the same fills, different `useProps()`       |
| **Call** a deal, then watch the **Status** bar | A fill that comes and goes, ranked against the page's own summary by `order`           |
| **Ask before advancing** in Settings      | Plugin state read by a contribution on another page — passed in as a prop, with no store   |
| **Break the next card** on the dashboard  | What the runtime channel does *not* wrap for you, and the boundary the plugin adds itself  |

## How a fill gets its props

Two directions meet inside one contribution, and
[src/plugins/telephony.tsx](src/plugins/telephony.tsx) has both in a single
component:

- from the **plugin**, where the element is written — `onDial`, `busy`, and
  anything else the plugin holds in `useState`
- from the **host**, where the element renders — `DealActions.useProps()`, which
  is why the same fill can be in seven table rows and know which deal it is in

Context works the same way: a fill reads it from the host's position in the
tree, which is how every contribution here calls `useCrm()` without the plugin
providing anything.

## Files

| File                                             | What it is                                                    |
| ------------------------------------------------ | ------------------------------------------------------------- |
| [src/app.tsx](src/app.tsx)                       | The installed plugins, as JSX                                 |
| [src/slots.ts](src/slots.ts)                     | Every extension point — seven `createSlot()` calls            |
| [src/shell.tsx](src/shell.tsx)                   | The shell: navigation, the status bar, the hosts              |
| [src/pages.tsx](src/pages.tsx)                   | The four pages, which are hosts and placeholders              |
| [src/crm.tsx](src/crm.tsx)                       | The app's own state and API — nothing the library knows about |
| [src/plugins](src/plugins)                       | Four plugins: five contributions, two, three, and a crash test |
| [`../crm-core`](../crm-core)                     | Shared with the Next.js examples: the domain data and the CSS |

## The two things this app cannot do

**Server-render any of it.** A fill registers from an effect, and effects do not
run on the server. That is the whole reason the declarative channel exists — see
the [pages router example](../nextjs-pages), where the same kind of contribution
is in the HTML, and the [app router one](../nextjs-app), where it streams.

**Isolate a contribution for you.** Nothing wraps a fill: it is the app's own
element in the app's own tree, so a crash takes the host with it unless someone
puts a boundary in. [src/plugins/faulty.tsx](src/plugins/faulty.tsx) puts one
around the contribution it knows can throw; `PluginProvider` does it per
contribution, for every plugin, without being asked.
