import { CRM_PLUGIN_IDS, preloadCrmState } from "crm-core/server"
import type { GetServerSidePropsContext } from "next"

/**
 * What every page sends to the client.
 *
 * The library asks for exactly one thing from a server component: **the plugin
 * list must be the same, in the same order, on the server and on the client.**
 * So the enabled set is data that travels with the HTML — recomputing it in the
 * browser is how hydration breaks.
 */
export type CrmPageProps = {
  enabled: string[]
  preloadedState: Record<string, unknown>
}

/**
 * In a real CRM this reads the tenant's row, a licence or a flag service. Here
 * it reads `?plugins=pipeline,email`, so you can watch the served HTML change.
 *
 * The ids come from `crm-core/server` rather than from the catalog: the pages
 * router would tolerate either, but the seam is the same one the app router
 * example is built on.
 */
function enabledFor(query: GetServerSidePropsContext["query"]): string[] {
  const installed: readonly string[] = CRM_PLUGIN_IDS

  if (typeof query.plugins !== "string") {
    return [...installed]
  }

  const requested = query.plugins.split(",").map((id) => id.trim())

  // Filtered from the catalog rather than built from the query, so the order is
  // always the catalog's — the order the client will rebuild.
  return installed.filter((id) => requested.includes(id))
}

export async function loadCrmPageProps(
  context: GetServerSidePropsContext,
): Promise<CrmPageProps> {
  return {
    enabled: enabledFor(context.query),
    // Loaded for the whole catalog, not just the enabled plugins: the store's
    // shape must not depend on a toggle.
    preloadedState: await preloadCrmState(),
  }
}
