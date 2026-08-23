// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  definePlugin,
  defineSlot,
  PluginProvider,
  usePluginId,
} from "create-slot"

const Panels = defineSlot("panels")
const NavMenu = defineSlot<{ current: string }>("nav-menu")
// [!endregion prelude]

// [!region slot-name]
// The registry keys contributions by name, so an empty one is two slots
// quietly sharing a bucket.
export const Broken = defineSlot("") // throws
export const Fixed = defineSlot("deal-actions")
// [!endregion slot-name]

// [!region plugin-id]
// The id becomes part of every contribution's React key.
export const brokenPlugin = definePlugin({ id: "" }) // throws
export const fixedPlugin = definePlugin({ id: "pricing" })
// [!endregion plugin-id]

// [!region provider]
// A `defineSlot` host reads the declared index from context, so the provider
// has to be above it.
export function App() {
  return (
    <PluginProvider plugins={[]}>
      <Panels.Host />
    </PluginProvider>
  )
}
// [!endregion provider]

// [!region use-plugin-id]
// Works: the host renders this component as a declared contribution, and the
// context that carries the plugin id is the one the host provides.
function Card() {
  const pluginId = usePluginId()

  return <article data-plugin={pluginId} />
}

export const reporting = definePlugin({
  id: "reporting",
  contributes: [Panels.contribute({ component: Card })],
})
// [!endregion use-plugin-id]

// [!region typed-slot]
// The type parameter is the host's props. Declare them on the slot.
export const StatusBar = defineSlot<{ label: string }>("status-bar")
// [!endregion typed-slot]

// [!region use-props]
// `useProps` is nullable on a `Fill`, because no host is guaranteed above it.
export function Item() {
  const props = NavMenu.useProps()

  if (!props) {
    return null
  }

  return <li>{props.current}</li>
}
// [!endregion use-props]
