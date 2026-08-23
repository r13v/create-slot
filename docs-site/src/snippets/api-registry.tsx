// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  definePlugin,
  defineSlot,
  type PluginDefinition,
  PluginProvider,
  usePluginId,
} from "create-slot"

function PricingItem({ current }: { current: string }) {
  return <li>{current === "/pricing" ? "Pricing (current)" : "Pricing"}</li>
}

declare function report(pluginId: string, slot: string, error: unknown): void
// [!endregion prelude]

// [!region define-slot]
const NavMenu = defineSlot<{ current: string }>("nav-menu")
// [!endregion define-slot]

// [!region contribute]
// Data plus a component — enumerable during render, so it reaches the HTML.
const contribution = NavMenu.contribute({ order: 10, component: PricingItem })
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

// [!region provider]
export function App({ route }: { route: string }) {
  return (
    <PluginProvider
      plugins={[pricing]}
      onError={({ pluginId, slot, error }) => report(pluginId, slot, error)}
      renderFailed={({ pluginId, reset }) => (
        <button type="button" onClick={reset}>
          Retry {pluginId}
        </button>
      )}
    >
      <ul>
        <NavMenu.Host current={route} />
      </ul>
    </PluginProvider>
  )
}
// [!endregion provider]

// [!region fill]
export function StatusChrome() {
  return (
    <NavMenu.Fill order={20}>
      <UnsavedItem />
    </NavMenu.Fill>
  )
}

function UnsavedItem() {
  // Null when no host is above — which a `Fill` element cannot promise.
  const props = NavMenu.useProps()

  return props ? <li>Unsaved changes on {props.current}</li> : null
}
// [!endregion fill]

// [!region use-plugin-id]
export function Card() {
  // Which plugin's entry the host is on. Throws outside a contribution.
  const pluginId = usePluginId()

  return <article data-plugin={pluginId} />
}
// [!endregion use-plugin-id]

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
