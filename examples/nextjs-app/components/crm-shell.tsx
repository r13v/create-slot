"use client"

import { type PluginError, PluginProvider } from "create-slot"
import {
  CRM_PLUGINS,
  type CrmPlugin,
  CrmRuntime,
  createCrmStore,
  createPluginStores,
} from "crm-core"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import type { Insight } from "../lib/insight"
import { InsightProvider, insights } from "../plugins/insights"
import { Layout } from "./layout"

/**
 * Everything the pages router put in `_app.tsx`, and one directive more.
 *
 * This is the client boundary. The server decided which plugins this request
 * gets and sent their **ids**; the manifests are imported here, on this side of
 * the boundary, because a React Server Component cannot hold a component or a
 * function in a prop — and could not import the catalog in the first place.
 */

/** Installed: the shared catalog plus this app's plugin, in `INSTALLED_IDS` order. */
const CATALOG: readonly CrmPlugin[] = [...CRM_PLUGINS, insights]

export function CrmShell({
  enabled,
  preloadedState,
  insight,
  children,
}: {
  /** The same list the server rendered with, in the same order. */
  enabled: string[]
  preloadedState: Record<string, unknown>
  /** A promise from a server component. Read with `use()` where it is needed. */
  insight: Promise<Insight>
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

  const plugins = useMemo(() => {
    const ids = new Set(enabledKey ? enabledKey.split(",") : [])

    return CATALOG.filter((plugin) => ids.has(plugin.id))
  }, [enabledKey])

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

  const onError = useCallback(({ pluginId, slot, error }: PluginError) => {
    console.error(`[crm] ${pluginId} → ${slot}`, error)
  }, [])

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
        <PluginProvider plugins={plugins} onError={onError}>
          <Layout current={current} enabled={enabled} toast={toast}>
            {children}
          </Layout>
        </PluginProvider>
      </InsightProvider>
    </CrmRuntime>
  )
}
