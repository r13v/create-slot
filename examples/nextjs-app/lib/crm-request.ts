/**
 * The seam.
 *
 * Three things run in this example — the proxy on the edge, the server
 * components, and the browser — and all three need the same facts: what the
 * request headers are called, and which plugins are installed in what order.
 * This module imports neither `next/headers` nor React, so all three may read
 * it.
 *
 * Since create-slot v4 the manifests themselves are server-legible (the
 * two-module discipline; `app/layout.tsx` resolves the slot graph in the
 * server graph). What still has to live on this neutral seam is the
 * ops-config half: the installed ORDER a request filters against, and the
 * header names — a client module cannot import `next/headers`, and functions
 * cannot cross the RSC boundary either way.
 */

import { CRM_PLUGIN_IDS } from "crm-core/server"

/** Set by `proxy.ts` from `?plugins=`, read by the root layout. */
export const PLUGINS_HEADER = "x-crm-plugins"

/** Set by `proxy.ts` from the request URL, read by the root layout: a server
 * component has no `usePathname`, so the current route travels as data. */
export const PATHNAME_HEADER = "x-crm-pathname"

/** This example's own plugin, the way the SPA example has its faulty one. */
export const INSIGHTS_ID = "insights"

/**
 * Installed here: the shared catalog plus this app's plugin, last.
 *
 * `components/crm-shell.tsx` builds the same order out of the manifests. The
 * library's one SSR requirement is that those two orders match.
 */
export const INSTALLED_IDS: readonly string[] = [...CRM_PLUGIN_IDS, INSIGHTS_ID]
