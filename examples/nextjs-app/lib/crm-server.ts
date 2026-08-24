import { preloadCrmState } from "crm-core/server"
import { headers } from "next/headers"

import { INSTALLED_IDS, PLUGINS_HEADER } from "./crm-request"
import { type Insight, loadInsight } from "./insight"

/**
 * What the root layout hands to the client shell.
 *
 * `enabled` and `preloadedState` are the same contract the pages router example
 * puts in `pageProps`: plain JSON, because the server and the client have to
 * agree on the plugin list and only data can cross that boundary. The manifests
 * themselves never cross it — the shell imports them itself.
 */
export type CrmRequest = {
  enabled: string[]
  preloadedState: Record<string, unknown>
  /** Deliberately not awaited. React streams it to the client that reads it. */
  insight: Promise<Insight>
}

/**
 * In a real CRM this reads the tenant's row, a licence or a flag service. Here
 * it reads `?plugins=pipeline,email`, which the proxy moved into a header,
 * because a layout is never given `searchParams`.
 */
function enabledFor(requested: string | null): string[] {
  if (requested === null) {
    return [...INSTALLED_IDS]
  }

  const ids = requested.split(",").map((id) => id.trim())

  // Filtered from the installed list rather than built from the request, so the
  // order is always the one the client will rebuild.
  return INSTALLED_IDS.filter((id) => ids.includes(id))
}

export async function loadCrmRequest(): Promise<CrmRequest> {
  const requested = (await headers()).get(PLUGINS_HEADER)

  return {
    enabled: enabledFor(requested),
    // Loaded for the whole catalog, not just the enabled plugins: the store's
    // shape must not depend on a toggle.
    preloadedState: await preloadCrmState(),
    // No `await`: awaiting here would hold up the whole document, which is the
    // one thing the app router is here to avoid.
    insight: loadInsight(),
  }
}
