import * as React from "react"

export type Fill = React.ReactElement

export type Slot<Props> = React.FC<{
  children: React.ReactElement
  order?: number
}> & {
  Host: React.FC<React.PropsWithChildren<Props>>
}

export type SlotConfig = {
  name?: string
  unmountDelay?: number
}

export type SetFills = React.Dispatch<React.SetStateAction<(Fill | null)[]>>
