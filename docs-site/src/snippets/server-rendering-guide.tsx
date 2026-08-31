// @jsx: react-jsx
"use client"

// [!region prelude]
import { ContributionBoundary, SlotHost, SlotProvider } from "create-slot"
import {
  definePlugin,
  defineSlot,
  entriesOf,
  type PluginDefinition,
  type Resolution,
  resolvePlugins,
} from "create-slot/core"
import { type ReactNode, use, useMemo } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"

const Panels = defineSlot<{ dealId: string }>("panels")

declare const pipeline: PluginDefinition
declare const email: PluginDefinition
declare function loadEnabledPluginIds(): Promise<readonly string[]>
declare function loadTarget(dealId: string): Promise<string>
// [!endregion prelude]

// [!region catalog]
// catalog.ts — one declaration of the order the server and the client agree on.
export const PLUGIN_IDS = ["pipeline", "email"] as const

const CATALOG: Record<string, PluginDefinition> = { pipeline, email }

export function pluginsFromIds(ids: readonly string[]): PluginDefinition[] {
  return ids.flatMap((id) => CATALOG[id] ?? [])
}
// [!endregion catalog]

// [!region ssr]
// server.tsx — no framework required. Resolve from the ids, render, and send
// the same ids with the HTML. Deep-equal resolutions produce identical
// markup; nothing depends on object identity across the seam.
export function renderPage(ids: readonly string[], dealId: string) {
  const resolution = resolvePlugins(pluginsFromIds(ids))

  const html = renderToString(
    <SlotProvider resolution={resolution}>
      <SlotHost slot={Panels} props={{ dealId }} />
    </SlotProvider>,
  )

  // The ids travel with the HTML. Recomputing them on the client is how
  // hydration breaks.
  return `<div id="root">${html}</div>
<script>window.__PLUGINS__ = ${JSON.stringify(ids)}</script>`
}
// [!endregion ssr]

// [!region hydrate]
// client.tsx — the same ids, read back off the page, resolved again.
export function start() {
  const ids = (window as unknown as { __PLUGINS__: string[] }).__PLUGINS__

  hydrateRoot(
    document.getElementById("root") as HTMLElement,
    <SlotProvider resolution={resolvePlugins(pluginsFromIds(ids))}>
      <SlotHost slot={Panels} props={{ dealId: "deal-1" }} />
    </SlotProvider>,
  )
}
// [!endregion hydrate]

// [!region boundary]
// providers.tsx — tier 1's client boundary: one "use client" module holds the
// provider, receives ids, and resolves behind the seam.
export function CrmProvider({
  ids,
  children,
}: {
  /** Ids, not components: the simplest data that crosses the boundary. */
  ids: readonly string[]
  children: ReactNode
}) {
  const resolution = useMemo(() => resolvePlugins(pluginsFromIds(ids)), [ids])

  return <SlotProvider resolution={resolution}>{children}</SlotProvider>
}
// [!endregion boundary]

// [!region server]
// page.tsx — a server component. It sends ids across the boundary, and the
// contributions are in the HTML it streams.
export async function DealPage({ dealId }: { dealId: string }) {
  const enabled = await loadEnabledPluginIds()

  return (
    <CrmProvider ids={enabled}>
      <SlotHost slot={Panels} props={{ dealId }} />
    </CrmProvider>
  )
}

// [!endregion server]

// [!region two-module]
// plugins/notes.ts — the two-module discipline, tier 2's whole trick. The
// manifest is a PLAIN module (no directive) that imports its component from a
// "use client" file. A server component may then import the manifest itself:
// `resolvePlugins` reads ids and contributions here, and the component
// crosses the RSC boundary as a client reference.
import NotesPanel from "./panel"

export const notes = definePlugin({
  id: "notes",
  contributes: [
    Panels.contribute("panel", { order: 10, component: NotesPanel }),
  ],
})
// [!endregion two-module]

// [!region tier2-server]
// app/layout.tsx — a SERVER component. `resolvePlugins` comes from
// "create-slot/core", the React-free entry, so it runs right here — and under
// the two-module discipline the Resolution it returns is serializable:
// metadata plus client references. The whole graph crosses as one prop.
declare function Providers(props: {
  resolution: Resolution
  children: ReactNode
}): ReactNode

export async function RootLayout({ children }: { children: ReactNode }) {
  const enabled = await loadEnabledPluginIds()
  const resolution = resolvePlugins(pluginsFromIds(enabled))

  return <Providers resolution={resolution}>{children}</Providers>
}
// [!endregion tier2-server]

// [!region server-host]
// app/server-panels.tsx — a host with no client half. `entriesOf` comes from
// "create-slot/core" (callable in a server component); `ContributionBoundary`
// ships as "use client", so the failure semantics stay the host's.
export function ServerPanels({ resolution }: { resolution: Resolution }) {
  const entries = entriesOf(resolution, Panels)

  return entries.map((entry) => {
    const Panel = entry.component // typed by the slot — no cast

    return (
      <ContributionBoundary
        key={entry.key}
        pluginId={entry.pluginId}
        contributionId={entry.contributionId}
        slot={entry.slot}
      >
        <Panel dealId="deal-1" />
      </ContributionBoundary>
    )
  })
}
// [!endregion server-host]

// [!region streaming]
// A contribution may read a promise the layout never awaited. The host wraps
// every contribution in `Suspense`, so this card arrives in a later chunk while
// the rest of the page goes out immediately.
export function PipelineCard({ dealId }: { dealId: string }) {
  const target = use(loadTarget(dealId))

  return <article>Target: {target}</article>
}
// [!endregion streaming]

// [!region deferred]
// `renderToString` does not support `Suspense`, so a `React.lazy` component
// never reaches the HTML there. It reaches the HTML only if the module is
// already resolved when the plugin list is built. Resolve the import first,
// then declare the contribution from what it returned.
const loadPanel = () => import("./panel")

export async function buildPlugins(): Promise<PluginDefinition[]> {
  const { default: DealPanel } = await loadPanel()

  return [
    definePlugin({
      id: "notes-eager",
      contributes: [
        Panels.contribute("panel", { order: 10, component: DealPanel }),
      ],
    }),
  ]
}
// [!endregion deferred]
