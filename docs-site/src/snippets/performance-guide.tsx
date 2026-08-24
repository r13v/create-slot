// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  definePlugin,
  defineSlot,
  type PluginDefinition,
  PluginProvider,
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
export function Unstable() {
  const [query, setQuery] = useState("")

  return (
    // A fresh array on every keystroke. The index is grouped and ranked once
    // per array identity, so this rebuilds it — and re-renders every
    // contribution — each time the provider renders.
    <PluginProvider plugins={ALL_PLUGINS.filter(isEnabled)}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} />
      <Toolbar.Host zoom={1} />
    </PluginProvider>
  )
}
// [!endregion unstable]

// [!region stable]
export function Stable() {
  const [query, setQuery] = useState("")
  const plugins = useMemo(() => ALL_PLUGINS.filter(isEnabled), [])

  return (
    <PluginProvider
      plugins={plugins}
      // Exempt: handlers live in a context of their own, read only where a
      // contribution is isolated, so an inline arrow never reaches a host.
      onError={({ error }) => report(error)}
    >
      <input value={query} onChange={(event) => setQuery(event.target.value)} />
      {/* `zoom={1}` is a value, so re-checking it is free. */}
      <Toolbar.Host zoom={1} />
    </PluginProvider>
  )
}
// [!endregion stable]

// [!region props]
export function Rebuilt({ zoom, accent }: Settings) {
  // `zoom` is a number, so re-checking it is free. `theme` is a new object on
  // every render, so every contribution counts it as a change — exactly as
  // `memo` would.
  return <Canvas.Host zoom={zoom} theme={{ accent }} />
}

export function Held({ zoom, accent }: Settings) {
  const theme = useMemo(() => ({ accent }), [accent])

  return <Canvas.Host zoom={zoom} theme={theme} />
}
// [!endregion props]

// [!region contribution]
// Still plain data. `contribute()` hands back the component you passed,
// untouched; the memoised view belongs to the host and is cached on your
// component, so rebuilding the index never remounts anything.
export const search = definePlugin({
  id: "search",
  contributes: [Toolbar.contribute({ order: 10, component: SearchBox })],
})
// [!endregion contribution]
