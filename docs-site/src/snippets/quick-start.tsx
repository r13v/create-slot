// @jsx: react-jsx
"use client"

// [!region slots]
import { createSlot } from "create-slot"

export const Slots = {
  Menu: createSlot<{ current: string }>(),
}
// [!endregion slots]

// [!region host]
export function Sidebar({ current }: { current: string }) {
  return (
    <nav>
      <ul>
        <li>Home</li>
        <Slots.Menu.Host current={current}>
          <li>Nothing installed yet</li>
        </Slots.Menu.Host>
      </ul>
    </nav>
  )
}
// [!endregion host]

// [!region fill]
export function PricingFeature() {
  return (
    <Slots.Menu order={10}>
      <PricingNavItem />
    </Slots.Menu>
  )
}
// [!endregion fill]

// [!region props]
function PricingNavItem() {
  const { current } = Slots.Menu.useProps()

  return (
    <li aria-current={current === "/pricing" ? "page" : undefined}>Pricing</li>
  )
}
// [!endregion props]

// [!region app]
export function App() {
  return (
    <>
      <Sidebar current="/pricing" />
      <PricingFeature />
    </>
  )
}
// [!endregion app]
