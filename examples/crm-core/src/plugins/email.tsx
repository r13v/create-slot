import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { definePlugin } from "create-slot"

import type { Deal } from "../data"
import type { CrmPlugin } from "../plugin"
import { DealActions, DealPanels, SettingsSections } from "../slots"
import { useCrmDispatch, usePluginState } from "../state"
import { Button, PluginCard } from "../ui"
import { type EmailState, loadEmailState } from "./email.server"

const slice = createSlice({
  name: "email",
  initialState: { signature: "— sent from the CRM", drafts: 0 } as EmailState,
  reducers: {
    drafted: (state) => {
      state.drafts += 1
    },
    signatureChanged: (state, action: PayloadAction<string>) => {
      state.signature = action.payload
    },
  },
})

const { drafted, signatureChanged } = slice.actions

/** Static, so the two examples render the same thread. */
const THREAD = [
  { from: "them", subject: "Re: renewal terms", when: "2 days ago" },
  { from: "us", subject: "Revised quote attached", when: "5 days ago" },
]

export const email: CrmPlugin = definePlugin({
  id: "email",
  title: "Email",
  description:
    "An action on every deal, the thread on the detail page, and a signature in settings.",

  contributes: [
    DealActions.contribute({ order: 20, component: ComposeAction }),
    DealPanels.contribute({ order: 20, component: ThreadPanel }),
    SettingsSections.contribute({ order: 20, component: SignatureSetting }),
  ],

  reducer: slice.reducer,
  // See `pipeline.tsx`: the body is in the module a server may import.
  preload: loadEmailState,

  setup: (api) =>
    api.registerCommand({
      id: "email.compose",
      title: "Compose an email",
      run: () => api.notify("Email: empty draft opened"),
    }),
})

function ComposeAction({ deal }: { deal: Deal }) {
  const dispatch = useCrmDispatch()

  return (
    <Button
      onClick={() => {
        dispatch(drafted())
      }}
    >
      Email {deal.contact.name.split(" ")[0]}
    </Button>
  )
}

function ThreadPanel({ deal }: { deal: Deal }) {
  const { signature, drafts } = usePluginState<EmailState>()

  return (
    <PluginCard title="Email">
      <ul className="stack">
        {THREAD.map((message) => (
          <li key={message.subject} className="row">
            <span>{message.subject}</span>
            <span className="muted">
              {message.from === "us" ? "you" : deal.contact.name} ·{" "}
              {message.when}
            </span>
          </li>
        ))}
      </ul>

      <p className="muted">
        {drafts} draft{drafts === 1 ? "" : "s"} · signature “{signature}”
      </p>
    </PluginCard>
  )
}

function SignatureSetting() {
  const dispatch = useCrmDispatch()
  const { signature } = usePluginState<EmailState>()

  return (
    <PluginCard title="Email">
      <label className="field">
        <span>Signature</span>
        <input
          value={signature}
          onChange={(event) => dispatch(signatureChanged(event.target.value))}
        />
      </label>
    </PluginCard>
  )
}
