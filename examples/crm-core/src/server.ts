/**
 * Everything about this CRM that a server must own regardless of the graph.
 *
 * Since v4 the manifests themselves are server-legible: `defineSlot` lives in
 * the React-free `create-slot/core`, and each plugin keeps its components in
 * a "use client" module, so a server component may import the catalog and
 * call `resolvePlugins` on it (see `../nextjs-app/app/layout.tsx`).
 *
 * What still cannot ride the manifest is this file's cargo: the installed
 * ORDER as ops-config (the list a request filters against), and the state
 * loaders — functions the RSC boundary could never serialize anyway. No
 * React, no store, no components.
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
