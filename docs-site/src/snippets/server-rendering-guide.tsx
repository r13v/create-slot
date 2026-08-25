// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  definePlugin,
  defineSlot,
  type PluginDefinition,
  PluginProvider,
} from "create-slot"
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

// [!region boundary]
// providers.tsx — the client boundary. Under React Server Components the
// registry can live nowhere else: `defineSlot` creates a context, and the
// `react-server` build of React does not export `createContext`.
export function CrmProvider({
  ids,
  children,
}: {
  /** Ids, not plugins: a component cannot be a prop of a server component. */
  ids: readonly string[]
  children: ReactNode
}) {
  const plugins = useMemo(() => pluginsFromIds(ids), [ids])

  return <PluginProvider plugins={plugins}>{children}</PluginProvider>
}
// [!endregion boundary]

// [!region server]
// page.tsx — a server component. It sends ids across the boundary, and the
// contributions are in the HTML it streams.
export async function DealPage({ dealId }: { dealId: string }) {
  const enabled = await loadEnabledPluginIds()

  return (
    <CrmProvider ids={enabled}>
      <Panels.Host dealId={dealId} />
    </CrmProvider>
  )
}
// [!endregion server]

// [!region ssr]
// server.tsx — no framework required. The same list, in the same order, is
// what the client will be given; everything else is derived from it in render.
export function renderPage(ids: readonly string[], dealId: string) {
  const html = renderToString(
    <CrmProvider ids={ids}>
      <Panels.Host dealId={dealId} />
    </CrmProvider>,
  )

  // The ids travel with the HTML. Recomputing them on the client is how
  // hydration breaks.
  return `<div id="root">${html}</div>
<script>window.__PLUGINS__ = ${JSON.stringify(ids)}</script>`
}
// [!endregion ssr]

// [!region hydrate]
// client.tsx — the same ids, read back off the page.
export function start() {
  const ids = (window as unknown as { __PLUGINS__: string[] }).__PLUGINS__

  hydrateRoot(
    document.getElementById("root") as HTMLElement,
    <CrmProvider ids={ids}>
      <Panels.Host dealId="deal-1" />
    </CrmProvider>,
  )
}
// [!endregion hydrate]

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
// then build the list from what it returned.
const loadPanel = () => import("./panel")

export async function buildPlugins(): Promise<PluginDefinition[]> {
  const { default: DealPanel } = await loadPanel()

  return [
    definePlugin({
      id: "notes",
      contributes: [Panels.contribute({ order: 10, component: DealPanel })],
    }),
  ]
}
// [!endregion deferred]
