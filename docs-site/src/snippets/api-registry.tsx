// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  ContributionBoundary,
  definePlugin,
  defineSlot,
  entriesOf,
  type PluginDefinition,
  resolvePlugins,
  type SlotError,
  SlotHost,
  SlotProvider,
  useContribution,
  useSlotProps,
} from "create-slot"

function PricingItem({ current }: { current: string }) {
  return <li>{current === "/pricing" ? "Pricing (current)" : "Pricing"}</li>
}

declare function report(error: SlotError): void
// [!endregion prelude]

// [!region define-slot]
const NavMenu = defineSlot<{ current: string }>("nav-menu")
// [!endregion define-slot]

// [!region contribute]
// Data plus a component, under a required id. The full id "pricing/nav-item"
// is the React key, the disable/override address, and the diagnostics name.
const contribution = NavMenu.contribute("nav-item", {
  order: 10,
  component: PricingItem,
})
// [!endregion contribute]

// [!region define-plugin]
export const pricing = definePlugin({
  id: "pricing",
  contributes: [contribution],
  // Any further field is yours. The library reads `id` and `contributes` only.
  title: "Pricing",
})

// Inference keeps your own fields.
export const label = pricing.title
// [!endregion define-plugin]

// [!region resolve]
// One pure, synchronous, deterministic function. Problems come back on
// `diagnostics` — never thrown, never silently dropped.
const resolution = resolvePlugins([pricing], {
  disable: { contributions: [] },
  overrides: [NavMenu.override("pricing/nav-item", { order: 5 })],
})

export const diagnostics = resolution.diagnostics
// [!endregion resolve]

// [!region entries-of]
// The entries of one slot, typed by its descriptor — what a hand-rolled or
// server host maps over.
export const navEntries = entriesOf(resolution, NavMenu)
// [!endregion entries-of]

// [!region provider]
function PluginFailed({ pluginId, reset }: SlotError & { reset: () => void }) {
  return (
    <button type="button" onClick={reset}>
      Retry {pluginId}
    </button>
  )
}

export function App({ route }: { route: string }) {
  return (
    <SlotProvider
      resolution={resolution}
      onError={report}
      Failed={PluginFailed}
    >
      <ul>
        <SlotHost slot={NavMenu} props={{ current: route }}>
          <li>No plugins installed</li>
        </SlotHost>
      </ul>
    </SlotProvider>
  )
}
// [!endregion provider]

// [!region render-entries]
// Full-ownership escape hatch: `renderEntries` owns layout, wrappers and the
// empty state. Key wrappers with `entry.key`, never with an array index.
export function NavColumns({ route }: { route: string }) {
  return (
    <SlotHost
      slot={NavMenu}
      props={{ current: route }}
      renderEntries={(entries) =>
        entries.length === 0 ? (
          <p>Nothing contributed</p>
        ) : (
          <ul>{entries.map((entry) => entry.node)}</ul>
        )
      }
    />
  )
}
// [!endregion render-entries]

// [!region use-slot-props]
// The nearest host's props for this slot; null outside one.
export function CurrentRoute() {
  const props = useSlotProps(NavMenu)

  return props ? <span>{props.current}</span> : null
}
// [!endregion use-slot-props]

// [!region use-contribution]
export function Card() {
  // The identity of the contribution rendering now. Throws outside one.
  const { slot, pluginId, contributionId } = useContribution()

  return (
    <article data-plugin={pluginId} data-id={contributionId} data-slot={slot} />
  )
}
// [!endregion use-contribution]

// [!region boundary]
// The isolation wrapper the default host places around every contribution —
// exported so a hand-rolled host keeps the same failure semantics.
export function HandRolledNav() {
  return entriesOf(resolution, NavMenu).map((entry) => {
    const Item = entry.component

    return (
      <ContributionBoundary
        key={entry.key}
        pluginId={entry.pluginId}
        contributionId={entry.contributionId}
        slot={entry.slot}
      >
        <Item current="/" />
      </ContributionBoundary>
    )
  })
}
// [!endregion boundary]

// [!region extend]
// `PluginDefinition` is the type to extend. `definePlugin` is generic over its
// argument, so an intersection keeps every field of your own.
type AppPlugin = PluginDefinition & {
  title: string
  permissions?: readonly string[]
}

const billing = definePlugin({
  id: "billing",
  title: "Billing",
  permissions: ["billing:read"],
}) satisfies AppPlugin

export const billingPermissions = billing.permissions
// [!endregion extend]
