import { definePlugin } from "create-slot/core"
import type { CrmPlugin } from "crm-core"
import { DashboardWidgets } from "crm-core/slots"

import { INSIGHTS_ID } from "../lib/crm-request"
import { AttainmentCard } from "./insights.components"

/**
 * This example's own plugin — the SPA example adds a faulty one, and this one
 * adds the thing only the app router can do: a streamed, server-fed card.
 *
 * A plain manifest module, per the two-module discipline: the server layout
 * imports it to resolve the graph, and `AttainmentCard` crosses the boundary
 * as a client reference.
 */
export const insights: CrmPlugin = definePlugin({
  id: INSIGHTS_ID,
  title: "Insights",
  description:
    "One dashboard card whose number comes from a slow server query, streamed in rather than waited for.",

  contributes: [
    DashboardWidgets.contribute("attainment", {
      order: 5,
      component: AttainmentCard,
    }),
  ],
})
