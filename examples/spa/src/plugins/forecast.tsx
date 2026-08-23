import { isClosed, money, STAGE_WEIGHT, weighted } from "crm-core/data"

import { useCrm } from "../crm"
import { DashboardWidgets, NavItems } from "../slots"
import { Link, PluginCard, PluginRow } from "../ui"

const ID = "forecast"

/** The smallest shape a plugin can have: a component that returns two fills. */
export function ForecastPlugin() {
  return (
    <>
      <NavItems order={20}>
        <ClosingLink />
      </NavItems>

      <DashboardWidgets order={20}>
        <ForecastWidget />
      </DashboardWidgets>
    </>
  )
}

const isClosing = (deal: { stage: keyof typeof STAGE_WEIGHT }) =>
  STAGE_WEIGHT[deal.stage] >= 0.6

function ClosingLink() {
  const { current } = NavItems.useProps()
  const { deals } = useCrm()
  const closing = deals.filter((deal) => !isClosed(deal) && isClosing(deal))

  return (
    <PluginRow plugin={ID}>
      <Link href="/deals" current={current === "/deals"}>
        Closing soon
      </Link>{" "}
      <span className="muted">{closing.length}</span>
    </PluginRow>
  )
}

function ForecastWidget() {
  const { deals } = useCrm()
  const open = deals.filter((deal) => !isClosed(deal))

  const best = [...open].sort(
    (a, b) =>
      b.amount * STAGE_WEIGHT[b.stage] - a.amount * STAGE_WEIGHT[a.stage],
  )[0]

  return (
    <PluginCard plugin={ID} title="Forecast">
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
