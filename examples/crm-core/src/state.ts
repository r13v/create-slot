import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import { usePluginId } from "create-slot"
import { useDispatch, useSelector } from "react-redux"

import { DEALS, type Deal, nextStage, type Stage } from "./data"

/**
 * The deals themselves belong to the shell, not to a plugin: plugins add
 * capabilities to a record the CRM already owns. Plugin slices sit next to this
 * one, keyed by plugin id — see `createCrmStore`.
 */
export const dealsSlice = createSlice({
  name: "deals",
  initialState: { items: [...DEALS] },
  reducers: {
    stageChanged(
      state,
      action: PayloadAction<{ id: string; stage: Stage }>,
    ): void {
      const deal = state.items.find((it) => it.id === action.payload.id)

      if (deal) {
        deal.stage = action.payload.stage
      }
    },
    stageAdvanced(state, action: PayloadAction<string>): void {
      const deal = state.items.find((it) => it.id === action.payload)

      if (deal) {
        deal.stage = nextStage(deal.stage)
      }
    },
  },
})

export const { stageChanged, stageAdvanced } = dealsSlice.actions

export type CrmState = { deals: { items: Deal[] } } & Record<string, unknown>

export const useDeals = (): Deal[] =>
  useSelector((state: CrmState) => state.deals.items)

export const useDeal = (id: string): Deal | undefined =>
  useSelector((state: CrmState) =>
    state.deals.items.find((deal) => deal.id === id),
  )

export const useCrmDispatch = () => useDispatch()

/**
 * A plugin's own slice, without the plugin having to name it.
 *
 * The store keys slices by plugin id, and the id is the one thing only the
 * library knows while a contribution renders — so `usePluginId` is what turns a
 * generic hook into "my state".
 */
export function usePluginState<T>(): T {
  const id = usePluginId()

  return useSelector((state: CrmState) => state[id] as T)
}
