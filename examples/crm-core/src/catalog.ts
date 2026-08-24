import type { CrmPlugin } from "./plugin"
import { email } from "./plugins/email"
import { forecast } from "./plugins/forecast"
import { pipeline } from "./plugins/pipeline"
import { telephony } from "./plugins/telephony"
import { CRM_PLUGIN_IDS, type CrmPluginId } from "./server"

/** The manifests, keyed by id. `satisfies` is what keeps the two in step. */
const INSTALLED = {
  pipeline,
  forecast,
  email,
  telephony,
} satisfies Record<CrmPluginId, CrmPlugin>

/**
 * Everything installed, enabled or not.
 *
 * The order matters twice: it breaks ties between contributions with the same
 * `order`, and it is the order the server and the client have to agree on — so
 * it is declared once, in `server.ts`, which is the half a server can read.
 */
export const CRM_PLUGINS: readonly CrmPlugin[] = CRM_PLUGIN_IDS.map(
  (id) => INSTALLED[id],
)

/**
 * The inventory a settings page needs — a `.map` over an array the application
 * owns. There is no library helper for this, and none is needed: the manifest
 * *is* data.
 */
export function describeCatalog(catalog: readonly CrmPlugin[]) {
  return catalog.map((plugin) => ({
    id: plugin.id,
    title: plugin.title,
    description: plugin.description,
    slots: [...new Set((plugin.contributes ?? []).map((it) => it.slot))],
    state: plugin.reducer
      ? "redux slice"
      : plugin.createStore
        ? "own store"
        : "none",
    views: Object.keys(plugin.views ?? {}),
  }))
}
