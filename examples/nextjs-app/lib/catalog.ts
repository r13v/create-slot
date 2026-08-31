import type { CrmPlugin } from "crm-core"
import { CRM_PLUGINS } from "crm-core/catalog"

import { insights } from "../plugins/insights"

/**
 * Installed here: the shared catalog plus this app's plugin, in
 * `INSTALLED_IDS` order (see `crm-request.ts`).
 *
 * A plain module on purpose: the server layout imports it to resolve the slot
 * graph, and the client shell imports it to assemble the runtime. One list,
 * two graphs, no drift.
 */
export const CATALOG: readonly CrmPlugin[] = [...CRM_PLUGINS, insights]

export function enabledPlugins(enabled: readonly string[]): CrmPlugin[] {
  const ids = new Set(enabled)

  return CATALOG.filter((plugin) => ids.has(plugin.id))
}
