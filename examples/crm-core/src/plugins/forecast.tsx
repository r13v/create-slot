import { definePlugin } from "create-slot/core"

import type { CrmPlugin } from "../plugin"
import { DashboardWidgets, NavItems } from "../slots"
import { ClosingLink, ForecastWidget } from "./forecast.components"
import { CLOSING_VIEW, isClosing } from "./forecast.shared"

/** The simplest shape a plugin can have: no state of its own at all. */
export const forecast: CrmPlugin = definePlugin({
  id: "forecast",
  title: "Forecast",
  description:
    "Pure UI over the shell's own deals: no slice, no store, no lifecycle. It reads state it does not own and adds a saved view.",

  contributes: [
    NavItems.contribute("closing-link", { order: 20, component: ClosingLink }),
    DashboardWidgets.contribute("forecast", {
      order: 20,
      component: ForecastWidget,
    }),
  ],

  views: {
    [CLOSING_VIEW]: { title: "Closing soon", match: isClosing },
  },
})
