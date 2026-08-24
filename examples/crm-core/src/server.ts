/**
 * Everything about this CRM that a server can read.
 *
 * The manifest cannot be one of those things. A plugin declares its
 * contributions through `defineSlot`, `defineSlot` uses `createContext`, and the
 * `react-server` build of React does not export `createContext` — so the
 * catalog, and every module that reaches it, belongs to the client graph. Under
 * the app router that is not a detail: a server component that imports
 * `crm-core` fails to build.
 *
 * Hence this entry point (`crm-core/server`): the plugin ids, in the order the
 * catalog uses, and the state each plugin loads per request. No React, no store,
 * no components.
 */

import { DEALS } from "./data"
import { loadEmailState } from "./plugins/email.server"
import { loadPipelineState } from "./plugins/pipeline.server"

/**
 * Everything installed, and the order it is installed in.
 *
 * The catalog is built from this list rather than the other way round, so the
 * order a server hands to the client is the order the client rebuilds.
 */
export const CRM_PLUGIN_IDS = [
  "pipeline",
  "forecast",
  "email",
  "telephony",
] as const

export type CrmPluginId = (typeof CRM_PLUGIN_IDS)[number]

/**
 * The other half of the seam: the loaders the manifest's `preload` fields point
 * at, addressed by plugin id, because the server cannot reach those fields.
 *
 * One implementation, two references — `pipeline.tsx` declares
 * `preload: loadPipelineState` so a reader of the plugin still sees its whole
 * story.
 */
const LOADERS: Partial<Record<CrmPluginId, () => Promise<unknown> | unknown>> =
  {
    pipeline: loadPipelineState,
    email: loadEmailState,
  }

/**
 * Every plugin's slice, in parallel, keyed by plugin id — and for the **whole
 * catalog** rather than the enabled subset: a store whose shape changes when a
 * plugin is toggled off cannot be preloaded by a server that does not know the
 * toggle yet.
 */
export async function preloadCrmState(): Promise<Record<string, unknown>> {
  const loaders = Object.entries(LOADERS) as [
    CrmPluginId,
    () => Promise<unknown> | unknown,
  ][]

  const loaded = await Promise.all(loaders.map(([, load]) => load()))

  const state: Record<string, unknown> = { deals: { items: [...DEALS] } }

  loaders.forEach(([id], at) => {
    state[id] = loaded[at]
  })

  return state
}
