// @jsx: react-jsx
"use client"

// [!region prelude]
import { definePlugin, defineSlot } from "create-slot/core"

const Toolbar = defineSlot<{ dealId: string }>("toolbar")
// [!endregion prelude]

// [!region declarative]
// Declarative: the contribution is data plus a component, under a required
// id. The resolver enumerates it before render — which is exactly what a
// server render needs.
export const exportPlugin = definePlugin({
  id: "export",
  contributes: [
    Toolbar.contribute("export-button", { order: 10, component: ExportButton }),
  ],
})

function ExportButton({ dealId }: { dealId: string }) {
  return <button type="button">Export {dealId}</button>
}

// [!endregion declarative]

// [!region runtime]
// Runtime: the fill is an element, registered from wherever it is mounted for
// as long as it is mounted. It lives entirely inside the createSlot() façade
// and never reaches server markup.
import { createSlot } from "create-slot"

const StatusItems = createSlot()

export function DraftIndicator({ dirty }: { dirty: boolean }) {
  if (!dirty) {
    return null
  }

  return (
    <StatusItems order={20}>
      <span>Unsaved changes</span>
    </StatusItems>
  )
}
// [!endregion runtime]
