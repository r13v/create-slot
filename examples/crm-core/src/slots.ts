import { defineSlot } from "create-slot/core"

import type { Deal } from "./data"

/**
 * Every declarative extension point of this CRM, in one file — and a plain,
 * server-importable one: `create-slot/core` is React-free, so manifests built
 * on these descriptors can be read by a server component too.
 *
 * The runtime channel (the status bar) lives in `status-bar.ts` instead,
 * because `createSlot` is the client half of the library.
 */

/** Saved views a plugin adds under the shell's own links. */
export const NavItems = defineSlot<{ current: string }>("crm.nav")

/** The dashboard is nothing but a shell heading and this slot. */
export const DashboardWidgets = defineSlot("crm.dashboard")

/**
 * One host per row of the deal list, plus one on the detail page — the same
 * contributions render in all of them, and each reads the props of the host
 * it landed in.
 */
export const DealActions = defineSlot<{
  deal: Deal
  scope: "row" | "detail"
}>("crm.deal-actions")

/** Sections of the deal detail page. */
export const DealPanels = defineSlot<{ deal: Deal }>("crm.deal-panel")

/** Sections of the settings page. */
export const SettingsSections = defineSlot("crm.settings")
