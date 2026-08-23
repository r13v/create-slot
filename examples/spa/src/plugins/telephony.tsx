import type { Deal } from "crm-core/data"
import { useState } from "react"

import { useCrm } from "../crm"
import { DashboardWidgets, DealActions, StatusBar } from "../slots"
import { Button, PluginCard } from "../ui"

const ID = "telephony"

type Call = { company: string; phone: string }

type Logged = Call & { id: number }

/** Companies repeat, so a call needs an identity of its own. */
let nextCallId = 0

/**
 * Ephemeral state of the plugin's own, shared by three contributions in three
 * different hosts — with no store, no context and nothing registered anywhere.
 *
 * Switch the plugin off in the sidebar and the state goes with the component,
 * because that is all it ever was.
 */
export function TelephonyPlugin() {
  const [call, setCall] = useState<Call | null>(null)
  const [history, setHistory] = useState<readonly Logged[]>([])

  const dial = (deal: Deal) =>
    setCall({ company: deal.company, phone: deal.contact.phone })

  const hangUp = () => {
    if (call) {
      setHistory((prev) => [{ ...call, id: nextCallId++ }, ...prev].slice(0, 4))
    }

    setCall(null)
  }

  return (
    <>
      <DealActions order={20}>
        <CallAction onDial={dial} busy={call !== null} />
      </DealActions>

      <DashboardWidgets order={30}>
        <CallLog history={history} />
      </DashboardWidgets>

      {/*
        A fill that comes and goes. While it is mounted the status bar shows
        the page's summary and this, ranked by `order`.
      */}
      {call && (
        <StatusBar order={10}>
          <CallStatus call={call} onHangUp={hangUp} />
        </StatusBar>
      )}
    </>
  )
}

function CallAction({
  onDial,
  busy,
}: {
  onDial: (deal: Deal) => void
  busy: boolean
}) {
  // Both directions in one component: `onDial` and `busy` came from the plugin,
  // where this element was written; `deal` and `scope` come from the host,
  // where it renders.
  const { deal, scope } = DealActions.useProps()
  const { notify } = useCrm()

  const call = () => {
    onDial(deal)
    notify(`Calling ${deal.contact.name} at ${deal.company}`)
  }

  return (
    <Button disabled={busy} onClick={call}>
      {scope === "detail" ? `Call ${deal.contact.name}` : "Call"}
    </Button>
  )
}

function CallStatus({ call, onHangUp }: { call: Call; onHangUp: () => void }) {
  return (
    <span className="row row--plugin" data-plugin={ID}>
      <span className="tag">{ID}</span>
      <span className="row__body">
        On a call with {call.company} · {call.phone}{" "}
        <Button tone="danger" onClick={onHangUp}>
          hang up
        </Button>
      </span>
    </span>
  )
}

function CallLog({ history }: { history: readonly Logged[] }) {
  return (
    <PluginCard plugin={ID} title="Recent calls">
      {history.length === 0 ? (
        <p className="muted">
          No calls yet. Place one from the deals table, then hang up.
        </p>
      ) : (
        <ul className="stack">
          {history.map((call) => (
            <li key={call.id} className="row">
              {call.company} <span className="muted">{call.phone}</span>
            </li>
          ))}
        </ul>
      )}
    </PluginCard>
  )
}
