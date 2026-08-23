"use client"

/**
 * The client boundary for the shared pages.
 *
 * A route file below is a server component, and a server component may not
 * import `crm-core`: the pages there use hooks, redux and context, none of which
 * exist in the `react-server` build of React. One module with this directive on
 * top turns them into client references the routes can render.
 */

export { DashboardPage, DealPage, DealsPage, SettingsPage } from "crm-core"
