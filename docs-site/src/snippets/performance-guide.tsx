// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  definePlugin,
  defineSlot,
  type PluginDefinition,
  resolvePlugins,
  SlotHost,
  SlotProvider,
} from "create-slot"
import { useMemo, useState } from "react"

const Toolbar = defineSlot<{ zoom: number }>("toolbar")
const Canvas = defineSlot<{ zoom: number; theme: { accent: string } }>("canvas")

type Settings = { zoom: number; accent: string }

declare const ALL_PLUGINS: readonly PluginDefinition[]
declare function isEnabled(plugin: PluginDefinition): boolean
declare function SearchBox(): React.ReactNode
declare function report(error: unknown): void
// [!endregion prelude]

// [!region unstable]
export function Inline() {
  const [query, setQuery] = useState("")

  return (
    // A fresh Resolution on every keystroke. Legal, and cheaper than it looks:
    // entries are compared by content, so hosts and boundary shells re-render
    // and no contribution renders, remounts or commits anything.
    <SlotProvider resolution={resolvePlugins(ALL_PLUGINS.filter(isEnabled))}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} />
      <SlotHost slot={Toolbar} props={{ zoom: 1 }} />
    </SlotProvider>
  )
}
// [!endregion unstable]

// [!region stable]
export function Stable() {
  const [query, setQuery] = useState("")
  // One line spares the hosts and shells too. Module scope works as well.
  const resolution = useMemo(
    () => resolvePlugins(ALL_PLUGINS.filter(isEnabled)),
    [],
  )

  return (
    <SlotProvider
      resolution={resolution}
      // Exempt: handlers live in a context of their own, read only where a
      // contribution is isolated, so an inline arrow never reaches a host.
      onError={({ error }) => report(error)}
    >
      <input value={query} onChange={(event) => setQuery(event.target.value)} />
      {/* `zoom: 1` is a value, so re-checking it is free. */}
      <SlotHost slot={Toolbar} props={{ zoom: 1 }} />
    </SlotProvider>
  )
}
// [!endregion stable]

// [!region props]
export function Rebuilt({ zoom, accent }: Settings) {
  // `zoom` is a number, so re-checking it is free. `theme` is a new object on
  // every render, so every contribution counts it as a change — exactly as
  // `memo` would.
  return <SlotHost slot={Canvas} props={{ zoom, theme: { accent } }} />
}

export function Held({ zoom, accent }: Settings) {
  const theme = useMemo(() => ({ accent }), [accent])

  return <SlotHost slot={Canvas} props={{ zoom, theme }} />
}
// [!endregion props]

// [!region contribution]
// Still plain data. `contribute()` hands back the component you passed,
// untouched; the memoised view belongs to the host and is cached on your
// component. The React key is the full id "search/search-box", so inserting
// or removing a neighbouring contribution never remounts this one.
export const search = definePlugin({
  id: "search",
  contributes: [
    Toolbar.contribute("search-box", { order: 10, component: SearchBox }),
  ],
})
// [!endregion contribution]
