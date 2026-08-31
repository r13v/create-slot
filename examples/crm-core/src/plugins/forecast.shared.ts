import { type Deal, isClosed, STAGE_WEIGHT } from "../data"

export const CLOSING_VIEW = "closing"

export const isClosing = (deal: Deal) =>
  !isClosed(deal) && STAGE_WEIGHT[deal.stage] >= 0.6
