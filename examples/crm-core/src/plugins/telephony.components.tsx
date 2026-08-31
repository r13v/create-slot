"use client"

import { observer } from "mobx-react-lite"

import type { Deal } from "../data"
import { usePluginStore } from "../runtime"
import { Button, PluginCard } from "../ui"
import type { CallStore } from "./telephony.store"

export const CallAction = observer(function CallAction({
  deal,
}: {
  deal: Deal
}) {
  const calls = usePluginStore<CallStore>()
  const onCall = calls.dealId === deal.id

  return (
    <Button
      tone={onCall ? "danger" : undefined}
      onClick={() => (onCall ? calls.stop() : calls.start(deal))}
    >
      {onCall ? `Hang up ${formatDuration(calls.seconds)}` : "Call"}
    </Button>
  )
})

export const ActiveCall = observer(function ActiveCall() {
  const calls = usePluginStore<CallStore>()

  return (
    <PluginCard title="Calls">
      {calls.active ? (
        <>
          <p className="kpi">
            {formatDuration(calls.seconds)} <small>{calls.company}</small>
          </p>
          <Button tone="danger" onClick={() => calls.stop()}>
            Hang up
          </Button>
        </>
      ) : (
        <p className="muted">
          No active call. Dial one from any deal — the server always renders
          this line, because a call cannot exist yet.
        </p>
      )}
    </PluginCard>
  )
})

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}
