import { definePlugin } from "create-slot/core"

import { isClosed, STALE_AFTER_DAYS } from "../data"
import type { CrmPlugin } from "../plugin"
import {
  DashboardWidgets,
  DealActions,
  DealPanels,
  NavItems,
  SettingsSections,
} from "../slots"
import {
  AdvanceStage,
  StageBreakdown,
  StagePanel,
  StaleDealsLink,
  TargetSetting,
} from "./pipeline.components"
import { loadPipelineState } from "./pipeline.server"
import { pipelineSlice, STALE_VIEW, targetRaised } from "./pipeline.state"

/**
 * The plugin a reader should look at first: it contributes to every slot,
 * keeps its own redux slice, loads that slice on the server and registers a
 * command.
 *
 * This manifest is a plain module — the two-module discipline. It imports its
 * components from a "use client" file, so a server component may import the
 * manifest itself: `resolvePlugins` reads ids and contributions here, and the
 * components cross the RSC boundary as client references.
 */
export const pipeline: CrmPlugin = definePlugin({
  id: "pipeline",
  title: "Pipeline",
  description:
    "Stages, the quarterly target and the stale-deal view. Its slice is declared here and preloaded by the server.",

  contributes: [
    NavItems.contribute("stale-link", { order: 10, component: StaleDealsLink }),
    DashboardWidgets.contribute("stage-breakdown", {
      order: 10,
      component: StageBreakdown,
    }),
    DealActions.contribute("advance-stage", {
      order: 10,
      component: AdvanceStage,
    }),
    DealPanels.contribute("stage-panel", { order: 10, component: StagePanel }),
    SettingsSections.contribute("target", {
      order: 10,
      component: TargetSetting,
    }),
  ],

  reducer: pipelineSlice.reducer,
  // The body lives in `pipeline.server.ts`, because state loading is a
  // per-request concern the server seam owns. See `../server.ts`.
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
