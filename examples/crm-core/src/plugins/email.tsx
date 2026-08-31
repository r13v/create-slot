import { definePlugin } from "create-slot/core"

import type { CrmPlugin } from "../plugin"
import { DealActions, DealPanels, SettingsSections } from "../slots"
import {
  ComposeAction,
  SignatureSetting,
  ThreadPanel,
} from "./email.components"
import { loadEmailState } from "./email.server"
import { emailSlice } from "./email.state"

export const email: CrmPlugin = definePlugin({
  id: "email",
  title: "Email",
  description:
    "An action on every deal, the thread on the detail page, and a signature in settings.",

  contributes: [
    DealActions.contribute("compose", { order: 20, component: ComposeAction }),
    DealPanels.contribute("thread", { order: 20, component: ThreadPanel }),
    SettingsSections.contribute("signature", {
      order: 20,
      component: SignatureSetting,
    }),
  ],

  reducer: emailSlice.reducer,
  // See `pipeline.tsx`: the body is in the module the server seam owns.
  preload: loadEmailState,

  setup: (api) =>
    api.registerCommand({
      id: "email.compose",
      title: "Compose an email",
      run: () => api.notify("Email: empty draft opened"),
    }),
})
