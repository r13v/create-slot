import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { definePlugin } from "create-slot"

import {
  type Deal,
  isClosed,
  money,
  nextStage,
  STAGES,
  STALE_AFTER_DAYS,
  type Stage,
} from "../data"
import type { CrmPlugin } from "../plugin"
import {
  DashboardWidgets,
  DealActions,
  DealPanels,
  NavItems,
  SettingsSections,
} from "../slots"
import {
  stageAdvanced,
  stageChanged,
  useCrmDispatch,
  useDeals,
  usePluginState,
} from "../state"
import { Button, Link, PluginCard, PluginRow, StageTag } from "../ui"
import { loadPipelineState, type PipelineState } from "./pipeline.server"

/**
 * The plugin a reader should look at first: it contributes to every slot, keeps
 * its own redux slice, loads that slice on the server and registers a command.
 */

const slice = createSlice({
  name: "pipeline",
  initialState: { quarterTarget: 250_000 } satisfies PipelineState,
  reducers: {
    targetChanged: (state, action: PayloadAction<number>) => {
      state.quarterTarget = action.payload
    },
    targetRaised: (state) => {
      state.quarterTarget = Math.round(state.quarterTarget * 1.1)
    },
  },
})

const { targetChanged, targetRaised } = slice.actions

const STALE_VIEW = "stale"

export const pipeline: CrmPlugin = definePlugin({
  id: "pipeline",
  title: "Pipeline",
  description:
    "Stages, the quarterly target and the stale-deal view. Its slice is declared here and preloaded by the server.",

  contributes: [
    NavItems.contribute({ order: 10, component: StaleDealsLink }),
    DashboardWidgets.contribute({ order: 10, component: StageBreakdown }),
    DealActions.contribute({ order: 10, component: AdvanceStage }),
    DealPanels.contribute({ order: 10, component: StagePanel }),
    SettingsSections.contribute({ order: 10, component: TargetSetting }),
  ],

  reducer: slice.reducer,
  // The body lives in `pipeline.server.ts`, because that is the half a server
  // component is allowed to import. See `../server.ts`.
  preload: loadPipelineState,

  views: {
    [STALE_VIEW]: {
      title: "Needs attention",
      match: (deal) => !isClosed(deal) && deal.idleDays >= STALE_AFTER_DAYS,
    },
  },

  setup: (api) =>
    api.registerCommand({
      id: "pipeline.raise-target",
      title: "Raise the quarterly target by 10%",
      run: () => {
        api.dispatch(targetRaised())
        api.notify("Pipeline: quarterly target raised")
      },
    }),
})

function StaleDealsLink({ current }: { current: string }) {
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

function StageBreakdown() {
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

function AdvanceStage({
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

function StagePanel({ deal }: { deal: Deal }) {
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

function TargetSetting() {
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
