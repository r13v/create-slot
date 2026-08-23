// @jsx: react-jsx
"use client"

// [!region prelude]
import { definePlugin, defineSlot } from "create-slot"

const Toolbar = defineSlot("toolbar")

function SearchBox() {
  return <input type="search" aria-label="Search" />
}

function FilterMenu() {
  return <button type="button">Filters</button>
}

function ExportButton() {
  return <button type="button">Export</button>
}

function ImportButton() {
  return <button type="button">Import</button>
}
// [!endregion prelude]

// [!region priority]
// `order` is a priority, not an array index. Leave gaps so a plugin can be
// inserted later without renumbering anything.
export const search = definePlugin({
  id: "search",
  contributes: [Toolbar.contribute({ order: 10, component: SearchBox })],
})

export const filters = definePlugin({
  id: "filters",
  contributes: [Toolbar.contribute({ order: 20, component: FilterMenu })],
})
// [!endregion priority]

// [!region tie]
// Two contributions may share one `order`. Both render; neither replaces the
// other. The tie is stable: plugin position first, then declaration order.
export const exportCsv = definePlugin({
  id: "export-csv",
  contributes: [
    Toolbar.contribute({ order: 20, component: ExportButton }),
    Toolbar.contribute({ order: 20, component: ImportButton }),
  ],
})
// [!endregion tie]

// [!region read-once]
export function UnstableOrder({ rank }: { rank: number }) {
  // Read once, when the fill mounts. Changing `rank` afterwards leaves the
  // fill exactly where it is — pass the value that is already final.
  return (
    <Toolbar.Fill order={rank}>
      <button type="button">Pinned</button>
    </Toolbar.Fill>
  )
}
// [!endregion read-once]
