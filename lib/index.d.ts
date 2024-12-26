import * as React from "react"

export type Fill = React.ReactElement

export type Slot<Props> = React.FC<{
  children: React.ReactElement
  order?: number
}> & {
  Host: React.FC<React.PropsWithChildren<Props>>
  useProps(): Props
}

export type PropsContext<Props> = React.Context<Props>

export type SetFills = React.Dispatch<React.SetStateAction<(Fill | null)[]>>

export function createSlot<Props>(): Slot<Props>
