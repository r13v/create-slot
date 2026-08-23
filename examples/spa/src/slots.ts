import { createSlot } from "create-slot"
import type { Deal } from "crm-core/data"

/**
 * Every extension point of this app, in one file.
 *
 * `createSlot()` is the whole setup: no manifest, no plugin array and no
 * provider. A slot is a component that contributes and a `Host` that renders
 * the contributions, and the two find each other through the slot object
 * itself.
 */

/** Saved links a plugin adds under the shell's own navigation. */
export const NavItems = createSlot<{ current: string }>()

/** The dashboard is the shell's own card and this slot. */
export const DashboardWidgets = createSlot()

/**
 * One host per row of the deal table, plus one on the detail page — the same
 * fills render in all of them, and each reads the props of the host it landed
 * in through `DealActions.useProps()`.
 */
export const DealActions = createSlot<{
  deal: Deal
  scope: "row" | "detail"
}>()

/** Sections of the deal detail page. */
export const DealPanels = createSlot<{ deal: Deal }>()

/** Sections of the settings page. */
export const SettingsSections = createSlot()

/** The shell's status bar. Whatever is mounted registers its own summary. */
export const StatusBar = createSlot()

/** The sidebar's switchboard, which the app fills with its own checkboxes. */
export const PluginSwitches = createSlot()
