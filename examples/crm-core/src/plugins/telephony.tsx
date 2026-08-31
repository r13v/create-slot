import { definePlugin } from "create-slot/core"

import type { CrmPlugin } from "../plugin"
import { DashboardWidgets, DealActions } from "../slots"
import { ActiveCall, CallAction } from "./telephony.components"
import { CallStore } from "./telephony.store"

export const telephony: CrmPlugin = definePlugin({
  id: "telephony",
  title: "Telephony",
  description:
    "Dials a contact and keeps the live call in its own MobX store — client-only state, so it declares 'createStore' rather than a slice.",

  contributes: [
    DealActions.contribute("call", { order: 30, component: CallAction }),
    DashboardWidgets.contribute("active-call", {
      order: 30,
      component: ActiveCall,
    }),
  ],

  createStore: () => new CallStore(),
})
