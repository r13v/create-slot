// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  createSlot,
  definePlugin,
  defineSlot,
  PluginProvider,
} from "create-slot"

// [!endregion prelude]

// [!region unchanged]
// Nothing to do. `createSlot`, `Slot`, `Slot.Host`, `Slot.useProps` and the
// `Slot<Props>` type are the names 2.x published, and they are unchanged.
const Menu = createSlot<{ current: string }>()

export function Feature() {
  return (
    <Menu order={10}>
      <li>Pricing</li>
    </Menu>
  )
}
// [!endregion unchanged]

// [!region order-before]
// 2.x: `order` was an array index, so two fills sharing one silently replaced
// each other. Order bands and strides existed to avoid the collision.
const BAND = 1000

export function LegacyFeature({ slot }: { slot: number }) {
  return (
    <Menu order={BAND + slot * 10}>
      <li>Pricing</li>
    </Menu>
  )
}
// [!endregion order-before]

// [!region order-after]
// 3.0: `order` is a real priority. Two fills that share one both render, in
// registration order, so the bands, the stride and the duplicate detector are
// all deletable.
export function Feature3({ current }: { current: string }) {
  return (
    <Menu order={10}>
      <li>{current}</li>
    </Menu>
  )
}
// [!endregion order-after]

// [!region to-registry]
// Moving one feature onto the declarative channel, so it lands in server HTML:
// the slot gains a name, the fill becomes a contribution, and the app gains a
// provider.
const NavMenu = defineSlot<{ current: string }>("nav-menu")

const pricing = definePlugin({
  id: "pricing",
  contributes: [NavMenu.contribute({ order: 10, component: PricingItem })],
})

function PricingItem({ current }: { current: string }) {
  return <li>{current}</li>
}

export function App({ route }: { route: string }) {
  return (
    <PluginProvider plugins={[pricing]}>
      <ul>
        <NavMenu.Host current={route} />
      </ul>
    </PluginProvider>
  )
}
// [!endregion to-registry]
