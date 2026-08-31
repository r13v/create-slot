"use client"

import { isClosed, money, STAGE_WEIGHT, weighted } from "../data"
import { useDeals } from "../state"
import { Link, PluginCard, PluginRow } from "../ui"
import { CLOSING_VIEW, isClosing } from "./forecast.shared"

export function ClosingLink({ current }: { current: string }) {
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

export function ForecastWidget() {
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
