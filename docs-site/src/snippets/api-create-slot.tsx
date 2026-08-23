// @jsx: react-jsx
"use client"

// [!region prelude]
import { createSlot } from "create-slot"

// [!endregion prelude]

// [!region factory]
const Menu = createSlot<{ current: string }>()
// [!endregion factory]

// [!region fill]
// The component itself is the contributor. `children` is one element.
export function PricingFeature() {
  return (
    <Menu order={10}>
      <PricingItem />
    </Menu>
  )
}
// [!endregion fill]

// [!region host]
// The host renders every mounted fill, or its own children while there are none.
export function Nav({ current }: { current: string }) {
  return (
    <ul>
      <Menu.Host current={current}>
        <li>Placeholder</li>
      </Menu.Host>
    </ul>
  )
}
// [!endregion host]

// [!region use-props]
function PricingItem() {
  // The props of the host doing the rendering. Never null: a fill's children
  // only ever render inside a host.
  const { current } = Menu.useProps()

  return <li>{current}</li>
}
// [!endregion use-props]
