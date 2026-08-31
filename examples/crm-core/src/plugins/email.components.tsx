"use client"

import type { Deal } from "../data"
import { useCrmDispatch, usePluginState } from "../state"
import { Button, PluginCard } from "../ui"
import type { EmailState } from "./email.server"
import { drafted, signatureChanged } from "./email.state"

/** Static, so the two examples render the same thread. */
const THREAD = [
  { from: "them", subject: "Re: renewal terms", when: "2 days ago" },
  { from: "us", subject: "Revised quote attached", when: "5 days ago" },
]

export function ComposeAction({ deal }: { deal: Deal }) {
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

export function ThreadPanel({ deal }: { deal: Deal }) {
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

export function SignatureSetting() {
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
