import { definePlugin } from "create-slot"

import { type Deal, isClosed, money, STAGE_WEIGHT, weighted } from "../data"
import type { CrmPlugin } from "../plugin"
import { DashboardWidgets, NavItems } from "../slots"
import { useDeals } from "../state"
import { Link, PluginCard, PluginRow } from "../ui"

/** The simplest shape a plugin can have: no state of its own at all. */

const CLOSING_VIEW = "closing"

const isClosing = (deal: Deal) =>
  !isClosed(deal) && STAGE_WEIGHT[deal.stage] >= 0.6

export const forecast: CrmPlugin = definePlugin({
  id: "forecast",
  title: "Forecast",
  description:
    "Pure UI over the shell's own deals: no slice, no store, no lifecycle. It reads state it does not own and adds a saved view.",

  contributes: [
    NavItems.contribute({ order: 20, component: ClosingLink }),
    DashboardWidgets.contribute({ order: 20, component: ForecastWidget }),
  ],

  views: {
    [CLOSING_VIEW]: { title: "Closing soon", match: isClosing },
  },
})

function ClosingLink({ current }: { current: string }) {
  const closing = useDeals().filter(isClosing)
  const href = `/deals?view=${CLOSING_VIEW}`

  return (
    <PluginRow>
      <Link href={href} current={current === href}>
        Closing soon
      </Link>{" "}
      <span className="muted">{closing.length}</span>
    </PluginRow>
  )
}

function ForecastWidget() {
  const deals = useDeals()
  const open = deals.filter((deal) => !isClosed(deal))

  const best = [...open].sort(
    (a, b) =>
      b.amount * STAGE_WEIGHT[b.stage] - a.amount * STAGE_WEIGHT[a.stage],
  )[0]

  return (
    <PluginCard title="Forecast">
      <p className="kpi">
        {money(weighted(open))}{" "}
        <small>weighted, {open.length} open deals</small>
      </p>

      {best && (
        <p className="muted">
          Biggest bet: {best.company} — {money(best.amount)} at{" "}
          {Math.round(STAGE_WEIGHT[best.stage] * 100)}%
        </p>
      )}
    </PluginCard>
  )
}
