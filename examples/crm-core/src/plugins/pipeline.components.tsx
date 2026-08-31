"use client"

import {
  type Deal,
  isClosed,
  money,
  nextStage,
  STAGES,
  STALE_AFTER_DAYS,
  type Stage,
} from "../data"
import {
  stageAdvanced,
  stageChanged,
  useCrmDispatch,
  useDeals,
  usePluginState,
} from "../state"
import { Button, Link, PluginCard, PluginRow, StageTag } from "../ui"
import type { PipelineState } from "./pipeline.server"
import { STALE_VIEW, targetChanged } from "./pipeline.state"

/**
 * The client half of the pipeline plugin. The directive above is what makes
 * the manifest server-legible: a server component importing the manifest gets
 * these components as client references it can render but never run.
 */

export function StaleDealsLink({ current }: { current: string }) {
  const stale = useDeals().filter(
    (deal) => !isClosed(deal) && deal.idleDays >= STALE_AFTER_DAYS,
  )

  const href = `/deals?view=${STALE_VIEW}`

  return (
    <PluginRow>
      <Link href={href} current={current === href}>
        Needs attention
      </Link>{" "}
      <span className="muted">{stale.length}</span>
    </PluginRow>
  )
}

export function StageBreakdown() {
  const deals = useDeals()
  const { quarterTarget } = usePluginState<PipelineState>()

  const won = deals
    .filter((deal) => deal.stage === "won")
    .reduce((total, deal) => total + deal.amount, 0)

  const share = Math.min(100, Math.round((won / quarterTarget) * 100))

  return (
    <PluginCard title="Stages">
      <p className="kpi">
        {money(won)} <small>of {money(quarterTarget)} won this quarter</small>
      </p>

      <div className="meter" role="img" aria-label={`${share}% of target`}>
        <span style={{ width: `${share}%` }} />
      </div>

      <ul className="bars">
        {STAGES.map((stage) => (
          <li key={stage}>
            <StageTag stage={stage} />
            <span className="muted">
              {deals.filter((deal) => deal.stage === stage).length}
            </span>
          </li>
        ))}
      </ul>
    </PluginCard>
  )
}

export function AdvanceStage({
  deal,
  scope,
}: {
  deal: Deal
  scope: "row" | "detail"
}) {
  const dispatch = useCrmDispatch()

  // One contribution reaches every host of its slot, so it decides for itself
  // where it belongs — a plain `if`, not a `when` predicate in the manifest.
  if (isClosed(deal)) {
    return null
  }

  return (
    <Button
      tone={scope === "detail" ? "primary" : undefined}
      onClick={() => dispatch(stageAdvanced(deal.id))}
    >
      {scope === "detail" ? `Advance to ${nextStage(deal.stage)}` : "Advance"}
    </Button>
  )
}

export function StagePanel({ deal }: { deal: Deal }) {
  const dispatch = useCrmDispatch()

  return (
    <PluginCard title="Stage">
      <label className="field">
        <span>Current stage</span>
        <select
          value={deal.stage}
          onChange={(event) =>
            dispatch(
              stageChanged({ id: deal.id, stage: event.target.value as Stage }),
            )
          }
        >
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
      </label>

      <p className="muted">
        Last activity {deal.idleDays} days ago
        {deal.idleDays >= STALE_AFTER_DAYS && " — overdue"}
      </p>
    </PluginCard>
  )
}

export function TargetSetting() {
  const dispatch = useCrmDispatch()
  const { quarterTarget } = usePluginState<PipelineState>()

  return (
    <PluginCard title="Pipeline">
      <label className="field">
        <span>Quarterly target</span>
        <input
          type="number"
          step={10_000}
          value={quarterTarget}
          onChange={(event) =>
            dispatch(targetChanged(Number(event.target.value) || 0))
          }
        />
      </label>
    </PluginCard>
  )
}
