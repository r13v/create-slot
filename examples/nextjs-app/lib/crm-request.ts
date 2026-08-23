/**
 * The seam.
 *
 * Three things run in this example — the proxy on the edge, the server
 * components, and the browser — and all three need the same two facts: what the
 * request header is called, and which plugins are installed in what order. This
 * module imports neither `next/headers` nor React, so all three may read it.
 *
 * That constraint is the whole shape of an app-router integration. A client
 * module cannot import `next/headers`; a server component that imports a client
 * module gets a reference, not the value; and the manifest itself is client-only,
 * because `defineSlot` uses `createContext`. Shared facts have to live somewhere
 * neutral.
 */

import { CRM_PLUGIN_IDS } from "crm-core/server"

/** Set by `proxy.ts` from `?plugins=`, read by the root layout. */
export const PLUGINS_HEADER = "x-crm-plugins"

/** This example's own plugin, the way the SPA example has its faulty one. */
export const INSIGHTS_ID = "insights"

/**
 * Installed here: the shared catalog plus this app's plugin, last.
 *
 * `components/crm-shell.tsx` builds the same order out of the manifests. The
 * library's one SSR requirement is that those two orders match.
 */
export const INSTALLED_IDS: readonly string[] = [...CRM_PLUGIN_IDS, INSIGHTS_ID]
