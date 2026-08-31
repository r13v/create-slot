// @jsx: react-jsx
"use client"

// [!region slots]
// slots.ts — pure data, importable from server modules too
import { defineSlot } from "create-slot/core"

export const NavMenu = defineSlot<{ current: string }>("nav-menu")
export const StatusBar = defineSlot("status-bar")

// [!endregion slots]

// [!region plugin]
// plugins/pricing.tsx
import { definePlugin } from "create-slot/core"

export const pricing = definePlugin({
  id: "pricing",
  contributes: [
    // "nav-item" is the contribution's id: required, unique inside the plugin.
    // The full id is "pricing/nav-item" — the React key and override target.
    NavMenu.contribute("nav-item", { order: 10, component: PricingNavItem }),
  ],
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
import { resolvePlugins, SlotHost, SlotProvider } from "create-slot"

// One pure function turns the plugin list into a Resolution. Resolve at
// module scope or in a `useMemo` — the provider never rebuilds anything.
const resolution = resolvePlugins([pricing])

export function App({ route }: { route: string }) {
  return (
    <SlotProvider resolution={resolution}>
      <ul>
        <SlotHost slot={NavMenu} props={{ current: route }}>
          <li>No plugins installed</li>
        </SlotHost>
      </ul>
    </SlotProvider>
  )
}
// [!endregion provider]

// [!region configure]
// The options bag: drop contributions by full id, patch them by full id.
const billing = definePlugin({
  id: "billing",
  contributes: [NavMenu.contribute("beta-banner", { component: BetaBanner })],
})

function BetaBanner() {
  return <li>Try the beta</li>
}

const configured = resolvePlugins([pricing, billing], {
  disable: { contributions: ["billing/beta-banner"] },
  overrides: [NavMenu.override("pricing/nav-item", { order: 5 })],
})

// Problems come back as data — never thrown, never silently dropped.
export const problems = configured.diagnostics

// [!endregion configure]

// [!region mixed]
// The registry never merges runtime fills. Content that must be in the HTML
// is declared; live chrome gets a façade slot of its own, with its own host.
import { createSlot } from "create-slot"

const LiveStatus = createSlot()

export function Shell({ route }: { route: string }) {
  return (
    <SlotProvider resolution={resolution}>
      <ul>
        <SlotHost slot={NavMenu} props={{ current: route }} />
      </ul>
      <footer>
        <LiveStatus.Host>
          <span>Idle</span>
        </LiveStatus.Host>
      </footer>
      {/* Registered while mounted. Never part of the Resolution. */}
      <LiveStatus order={10}>
        <span>Unsaved changes</span>
      </LiveStatus>
    </SlotProvider>
  )
}

// [!endregion mixed]

// [!region enabled]
// enabling.tsx — the enabled set is application data. Filter the array, or
// keep the list whole and `disable` by id; both produce a new Resolution.
import type { PluginDefinition } from "create-slot/core"
import { useMemo } from "react"

declare const CATALOG: readonly PluginDefinition[]
declare function useFlags(): Record<string, boolean>
declare function AppShell(): React.ReactNode

export function Enabled() {
  const flags = useFlags()

  // One line. An inline `resolvePlugins()` per render is legal too — entries
  // are compared by content — but the memo spares the hosts as well.
  const enabled = useMemo(
    () =>
      resolvePlugins(CATALOG.filter((plugin) => flags[plugin.id] !== false)),
    [flags],
  )

  return (
    <SlotProvider resolution={enabled}>
      <AppShell />
    </SlotProvider>
  )
}
// [!endregion enabled]
