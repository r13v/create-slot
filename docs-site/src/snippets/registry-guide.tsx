// @jsx: react-jsx
"use client"

// [!region slots]
// slots.ts
import { defineSlot } from "create-slot"

export const NavMenu = defineSlot<{ current: string }>("nav-menu")
export const StatusBar = defineSlot("status-bar")

// [!endregion slots]

// [!region plugin]
// plugins/pricing.tsx
import { definePlugin } from "create-slot"

export const pricing = definePlugin({
  id: "pricing",
  contributes: [NavMenu.contribute({ order: 10, component: PricingNavItem })],
})

function PricingNavItem({ current }: { current: string }) {
  // An ordinary component: hooks, context, data fetching, all of it.
  if (current === "/checkout") {
    return null
  }

  return <li>Pricing</li>
}

// [!endregion plugin]

// [!region provider]
// app.tsx
import { type PluginDefinition, PluginProvider } from "create-slot"

export function App({
  route,
  enabled,
}: {
  route: string
  /** Already filtered by the application: flags, tenant, permissions. */
  enabled: readonly PluginDefinition[]
}) {
  return (
    <PluginProvider plugins={enabled}>
      <ul>
        <NavMenu.Host current={route}>
          <li>No plugins installed</li>
        </NavMenu.Host>
      </ul>
    </PluginProvider>
  )
}
// [!endregion provider]

// [!region mixed]
// Both channels feed the same host and rank on the same `order`.
export function Shell({ route }: { route: string }) {
  return (
    <PluginProvider plugins={[pricing]}>
      <ul>
        <NavMenu.Host current={route} />
      </ul>
      {/* Declared at order 10, so this runtime fill lands after it. */}
      <NavMenu.Fill order={20}>
        <li>Unsaved changes</li>
      </NavMenu.Fill>
    </PluginProvider>
  )
}

// [!endregion mixed]

// [!region enabled]
// enabling.tsx — the library never filters. `plugins` is whatever array you
// hand it, so enabling and disabling is an application concern.
import { useMemo } from "react"

declare const CATALOG: readonly PluginDefinition[]
declare function useFlags(): Record<string, boolean>
declare function AppShell(): React.ReactNode

export function Enabled() {
  const flags = useFlags()

  // Memoised: the index is grouped and ranked once per array identity.
  const plugins = useMemo(
    () => CATALOG.filter((plugin) => flags[plugin.id] !== false),
    [flags],
  )

  return (
    <PluginProvider plugins={plugins}>
      <AppShell />
    </PluginProvider>
  )
}
// [!endregion enabled]
