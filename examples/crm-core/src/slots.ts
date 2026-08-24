import { createSlot, defineSlot } from "create-slot"

import type { Deal } from "./data"

/**
 * Every extension point of this CRM, in one file.
 *
 * The five `defineSlot` ones are the declarative channel: a plugin declares its
 * contribution up front, the host resolves it during render, and the server
 * puts it in the HTML.
 */

/** Saved views a plugin adds under the shell's own links. */
export const NavItems = defineSlot<{ current: string }>("crm:nav")

/** The dashboard is nothing but a shell heading and this slot. */
export const DashboardWidgets = defineSlot("crm:dashboard")

/**
 * One host per row of the deal list, plus one on the detail page — the same
 * contributions render in all of them, and each reads the props of the host
 * it landed in.
 */
export const DealActions = defineSlot<{
  deal: Deal
  scope: "row" | "detail"
}>("crm:deal-actions")

/** Sections of the deal detail page. */
export const DealPanels = defineSlot<{ deal: Deal }>("crm:deal-panel")

/** Sections of the settings page. */
export const SettingsSections = defineSlot("crm:settings")

/**
 * The runtime channel, and the one thing here that cannot be server-rendered.
 *
 * Whichever page is mounted contributes its own summary to the shell's status
 * bar. That is live tree state — no manifest can know it up front — so it
 * registers from an effect and appears after hydration.
 */
export const StatusBar = createSlot()
