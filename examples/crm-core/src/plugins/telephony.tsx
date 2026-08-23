import { definePlugin } from "create-slot"
import { makeAutoObservable } from "mobx"
import { observer } from "mobx-react-lite"

import type { Deal } from "../data"
import type { CrmPlugin } from "../plugin"
import { usePluginStore } from "../runtime"
import { DashboardWidgets, DealActions } from "../slots"
import { Button, PluginCard } from "../ui"

/**
 * The other kind of plugin state: ephemeral, client-only and nobody else's
 * business — a live call.
 *
 * Redux would be the wrong home for it (there is nothing to preload and nothing
 * to serialise), so this plugin declares `createStore` instead and the shell
 * hands the instance back through `usePluginId`. A server render creates one and
 * simply never starts a call in it.
 */
class CallStore {
  dealId: string | null = null
  company = ""
  seconds = 0

  private timer: ReturnType<typeof setInterval> | null = null

  constructor() {
    makeAutoObservable(this)
  }

  get active(): boolean {
    return this.dealId !== null
  }

  start(deal: Deal): void {
    this.stop()
    this.dealId = deal.id
    this.company = deal.company
    this.seconds = 0
    this.timer = setInterval(() => this.tick(), 1000)
  }

  tick(): void {
    this.seconds += 1
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    this.dealId = null
    this.seconds = 0
  }
}

const CallAction = observer(function CallAction({ deal }: { deal: Deal }) {
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

const ActiveCall = observer(function ActiveCall() {
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

export const telephony: CrmPlugin = definePlugin({
  id: "telephony",
  title: "Telephony",
  description:
    "Dials a contact and keeps the live call in its own MobX store — client-only state, so it declares 'createStore' rather than a slice.",

  contributes: [
    DealActions.contribute({ order: 30, component: CallAction }),
    DashboardWidgets.contribute({ order: 30, component: ActiveCall }),
  ],

  createStore: () => new CallStore(),
})
