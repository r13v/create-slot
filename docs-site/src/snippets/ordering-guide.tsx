// @jsx: react-jsx
"use client"

// [!region prelude]
import { createSlot, definePlugin, defineSlot } from "create-slot"

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
  contributes: [
    Toolbar.contribute("search-box", { order: 10, component: SearchBox }),
  ],
})

export const filters = definePlugin({
  id: "filters",
  contributes: [
    Toolbar.contribute("menu", { order: 20, component: FilterMenu }),
  ],
})
// [!endregion priority]

// [!region tie]
// Two contributions may share one `order`. Both render; neither replaces the
// other. The tie is stable: plugin position first, then declaration order.
export const exportCsv = definePlugin({
  id: "export-csv",
  contributes: [
    Toolbar.contribute("export", { order: 20, component: ExportButton }),
    Toolbar.contribute("import", { order: 20, component: ImportButton }),
  ],
})
// [!endregion tie]

// [!region override]
// The application re-ranks a contribution it does not own by its full id.
// Typed patches come from the slot: `override` is where a replacement
// component would be checked against the slot's props.
export const reranked = Toolbar.override("export-csv/import", { order: 5 })
// [!endregion override]

// [!region read-once]
const StatusItems = createSlot()

export function UnstableOrder({ rank }: { rank: number }) {
  // A façade fill reads `order` once, when it mounts. Changing `rank`
  // afterwards leaves the fill exactly where it is — pass the value that is
  // already final.
  return (
    <StatusItems order={rank}>
      <button type="button">Pinned</button>
    </StatusItems>
  )
}
// [!endregion read-once]
