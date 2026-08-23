// @jsx: react-jsx
"use client"

// [!region prelude]
import { definePlugin, defineSlot } from "create-slot"

const Toolbar = defineSlot<{ dealId: string }>("toolbar")
// [!endregion prelude]

// [!region declarative]
// Declarative: the contribution is data plus a component. A host can enumerate
// it during render, which is exactly what a server render needs.
export const exportPlugin = definePlugin({
  id: "export",
  contributes: [Toolbar.contribute({ order: 10, component: ExportButton })],
})

function ExportButton({ dealId }: { dealId: string }) {
  return <button type="button">Export {dealId}</button>
}
// [!endregion declarative]

// [!region runtime]
// Runtime: the contribution is an element, registered from wherever it is
// mounted for as long as it is mounted. It cannot reach server markup.
export function DraftIndicator({ dirty }: { dirty: boolean }) {
  if (!dirty) {
    return null
  }

  return (
    <Toolbar.Fill order={20}>
      <span>Unsaved changes</span>
    </Toolbar.Fill>
  )
}
// [!endregion runtime]
