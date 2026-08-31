"use client"

import { type Resolution, type SlotError, SlotProvider } from "create-slot"
import { CrmRuntime, createCrmStore, createPluginStores } from "crm-core"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import { CATALOG, enabledPlugins } from "../lib/catalog"
import type { Insight } from "../lib/insight"
import { InsightProvider } from "../plugins/insights.components"
import { Layout } from "./layout"

/**
 * Everything the pages router put in `_app.tsx`, and one directive more.
 *
 * This is the client boundary. The slot graph arrives PRE-RESOLVED from the
 * server layout — the Resolution is metadata plus client references, so it
 * crosses the boundary whole. What cannot cross are functions: reducers,
 * stores and `setup` lifecycles, which is why this shell still assembles the
 * runtime's plugin list from the ids and the catalog it imports itself.
 */

export function CrmShell({
  enabled,
  resolution,
  preloadedState,
  insight,
  serverNav,
  children,
}: {
  /** The same list the server rendered with, in the same order. */
  enabled: string[]
  /** The slot graph the server resolved; hosts below read exactly this. */
  resolution: Resolution
  preloadedState: Record<string, unknown>
  /** A promise from a server component. Read with `use()` where it is needed. */
  insight: Promise<Insight>
  /** A server-rendered host, composed on the other side of the boundary. */
  serverNav: ReactNode
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [toast, setToast] = useState<string | null>(null)

  // Created once and kept for as long as this layout is mounted — which, in the
  // app router, means across every client navigation under it.
  const [store] = useState(() => createCrmStore(CATALOG, preloadedState))
  const [stores] = useState(() => createPluginStores(CATALOG))

  const enabledKey = enabled.join(",")

  // For the RUNTIME (stores, views, setup) — the slot graph itself arrived
  // resolved. Same ids, same catalog order, so the two cannot disagree.
  const plugins = useMemo(
    () => enabledPlugins(enabledKey.split(",")),
    [enabledKey],
  )

  // The pages router's `asPath`, in two hooks: the nav marks a saved view as
  // current, and a saved view lives in the query string.
  const query = searchParams.toString()
  const current = query ? `${pathname}?${query}` : pathname

  const navigate = useCallback(
    (href: string) => {
      router.push(href)
    },
    [router],
  )

  const notify = useCallback((message: string) => setToast(message), [])

  const onError = useCallback(
    ({ pluginId, contributionId, slot, error }: SlotError) => {
      console.error(`[crm] ${pluginId}/${contributionId} → ${slot}`, error)
    },
    [],
  )

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = setTimeout(() => setToast(null), 2400)

    return () => clearTimeout(timer)
  }, [toast])

  return (
    <CrmRuntime
      plugins={plugins}
      catalog={CATALOG}
      store={store}
      stores={stores}
      navigate={navigate}
      notify={notify}
    >
      <InsightProvider insight={insight}>
        <SlotProvider resolution={resolution} onError={onError}>
          <Layout
            current={current}
            enabled={enabled}
            toast={toast}
            serverNav={serverNav}
          >
            {children}
          </Layout>
        </SlotProvider>
      </InsightProvider>
    </CrmRuntime>
  )
}
