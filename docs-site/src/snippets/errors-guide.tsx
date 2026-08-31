// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  definePlugin,
  defineSlot,
  resolvePlugins,
  SlotHost,
  SlotProvider,
  useContribution,
  useSlotProps,
} from "create-slot"

const Panels = defineSlot("panels")
const NavMenu = defineSlot<{ current: string }>("nav-menu")
// [!endregion prelude]

// [!region slot-name]
// The Resolution keys contributions by slot name, so an empty one is two
// slots quietly sharing a bucket.
export const Broken = defineSlot("") // throws
export const Fixed = defineSlot("deal-actions")
// [!endregion slot-name]

// [!region plugin-id]
// The id namespaces every contribution id and React key.
export const brokenPlugin = definePlugin({ id: "" }) // throws
export const fixedPlugin = definePlugin({ id: "pricing" })
// [!endregion plugin-id]

// [!region provider]
// `SlotHost` reads the Resolution from context, so the provider has to be
// above it.
export function App() {
  return (
    <SlotProvider resolution={resolvePlugins([])}>
      <SlotHost slot={Panels} />
    </SlotProvider>
  )
}
// [!endregion provider]

// [!region use-contribution]
// Works: the host renders this component as a declared contribution, and the
// context that carries the identity is the one its boundary provides.
function Card() {
  const { pluginId, contributionId } = useContribution()

  return <article data-plugin={pluginId} data-id={contributionId} />
}

export const reporting = definePlugin({
  id: "reporting",
  contributes: [Panels.contribute("card", { component: Card })],
})
// [!endregion use-contribution]

// [!region diagnostics]
// The resolver never throws over a manifest defect: it reports. Assert on the
// list in a test, and the provider prints it once per content change in
// development.
export const { diagnostics } = resolvePlugins([
  definePlugin({ id: "pricing" }),
  definePlugin({ id: "pricing" }), // duplicate-plugin-id
])
// [!endregion diagnostics]

// [!region typed-slot]
// The type parameter is the host's props. Declare them on the slot.
export const StatusBar = defineSlot<{ label: string }>("status-bar")
// [!endregion typed-slot]

// [!region use-props]
// `useSlotProps` is nullable, because no host is guaranteed above the caller.
export function Item() {
  const props = useSlotProps(NavMenu)

  if (!props) {
    return null
  }

  return <li>{props.current}</li>
}
// [!endregion use-props]
