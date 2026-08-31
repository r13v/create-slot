import "crm-core/crm.css"

import { resolvePlugins, type SlotError, SlotProvider } from "create-slot"
import {
  CRM_PLUGINS,
  CrmRuntime,
  createCrmStore,
  createPluginStores,
} from "crm-core"
import type { AppProps } from "next/app"
import { useRouter } from "next/router"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Layout } from "../components/layout"
import type { CrmPageProps } from "../lib/crm-server"

/**
 * The whole integration, and there is nothing Next-specific in it beyond the
 * router: build the plugin list from what the server sent, resolve it once,
 * hand the Resolution to `SlotProvider`, and every host below is
 * server-rendered.
 */
export default function CrmApp({
  Component,
  pageProps,
}: AppProps<Partial<CrmPageProps>>) {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)

  // Created once and kept across client navigations, from the state the first
  // response carried. The shape comes from the catalog, so it never depends on
  // which plugins this particular request enabled.
  const [store] = useState(() =>
    createCrmStore(CRM_PLUGINS, pageProps.preloadedState),
  )
  const [stores] = useState(() => createPluginStores(CRM_PLUGINS))

  // The same list the server rendered with, in the same order. This is the
  // library's only SSR requirement.
  const enabled = pageProps.enabled ?? []
  const enabledKey = enabled.join(",")

  const plugins = useMemo(() => {
    const ids = new Set(enabledKey ? enabledKey.split(",") : [])

    return CRM_PLUGINS.filter((plugin) => ids.has(plugin.id))
  }, [enabledKey])

  // Resolved from the same inputs on the server and on the client, inside the
  // same render — deep-equal graphs, identical markup. The memo is the
  // application's own: the provider never rebuilds anything.
  const resolution = useMemo(() => resolvePlugins(plugins), [plugins])

  const navigate = useCallback(
    (href: string) => {
      void router.push(href)
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
      catalog={CRM_PLUGINS}
      store={store}
      stores={stores}
      navigate={navigate}
      notify={notify}
    >
      <SlotProvider resolution={resolution} onError={onError}>
        <Layout current={router.asPath} enabled={enabled} toast={toast}>
          <Component {...pageProps} />
        </Layout>
      </SlotProvider>
    </CrmRuntime>
  )
}
