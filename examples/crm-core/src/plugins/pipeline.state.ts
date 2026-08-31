import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { PipelineState } from "./pipeline.server"

/**
 * The slice in its own plain module, importable from both halves of the
 * plugin: the manifest declares `reducer`, the client components dispatch the
 * actions — and neither has to import the other.
 */
export const pipelineSlice = createSlice({
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

export const { targetChanged, targetRaised } = pipelineSlice.actions

export const STALE_VIEW = "stale"
