// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  createSlot,
  definePlugin,
  defineSlot,
  type RuntimeSlot,
  resolvePlugins,
  type SlotError,
  SlotHost,
  SlotProvider,
  useContribution,
} from "create-slot"

// [!endregion prelude]

// [!region unchanged]
// Nothing to do at runtime. `createSlot`, `Slot`, `Slot.Host` and
// `Slot.useProps` are the names 2.x published, and they still mean what they
// meant.
const Menu = createSlot<{ current: string }>()

export function Feature() {
  return (
    <Menu order={10}>
      <li>Pricing</li>
    </Menu>
  )
}

// One rename: the type 2.x called `Slot<Props>` is now `RuntimeSlot<Props>`.
// `Slot<Props>` names the descriptor `defineSlot` returns instead.
export type MenuSlot = RuntimeSlot<{ current: string }>
// [!endregion unchanged]

// [!region after]
// The 4.0 shape of a v3 registry: the contribution gains a required id, the
// provider takes a Resolution, and the host is one generic component with an
// explicit props bag.
const NavMenu = defineSlot<{ current: string }>("nav-menu")

const pricing = definePlugin({
  id: "pricing",
  contributes: [
    NavMenu.contribute("nav-item", { order: 10, component: PricingItem }),
  ],
})

function PricingItem({ current }: { current: string }) {
  return <li>{current}</li>
}

const resolution = resolvePlugins([pricing])

export function App({ route }: { route: string }) {
  return (
    <SlotProvider resolution={resolution}>
      <ul>
        <SlotHost slot={NavMenu} props={{ current: route }} />
      </ul>
    </SlotProvider>
  )
}
// [!endregion after]

// [!region failed]
// `renderFailed` becomes `Failed` — a component, so its identity is stable
// and it crosses an RSC boundary. It also learns which contribution failed.
function PluginFailed({ pluginId, reset }: SlotError & { reset: () => void }) {
  return (
    <button type="button" onClick={reset}>
      Retry {pluginId}
    </button>
  )
}

export function Isolated() {
  return (
    <SlotProvider resolution={resolution} Failed={PluginFailed}>
      <SlotHost slot={NavMenu} props={{ current: "/" }} />
    </SlotProvider>
  )
}
// [!endregion failed]

// [!region identity]
// `usePluginId()` becomes `useContribution().pluginId`, and the hook now also
// names the contribution and the slot.
export function Card() {
  const { pluginId, contributionId, slot } = useContribution()

  return (
    <article data-plugin={pluginId} data-id={contributionId} data-slot={slot} />
  )
}
// [!endregion identity]
