// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  type Contribution,
  definePlugin,
  defineSlot,
  type PluginDefinition,
  PluginProvider,
} from "create-slot"
import { type ReactNode, useMemo } from "react"

const DealRow = defineSlot<{ dealId: string; selected: boolean }>("deal-row")

type DealView = { label: string; filter: string }

declare function useFeatureFlag(name: string): boolean
declare const CATALOG: readonly PluginDefinition[]
declare function DraftBadge(): ReactNode
declare function AppShell(): ReactNode
// [!endregion prelude]

// [!region per-host]
// One contribution, one host per row. A declared contribution receives the
// host's props as its own, so the same code can opt out of one row and not the
// next.
export function DealTable({
  deals,
}: {
  deals: { id: string; selected: boolean }[]
}) {
  return (
    <ul>
      {deals.map((deal) => (
        <li key={deal.id}>
          {deal.id}
          <DealRow.Host dealId={deal.id} selected={deal.selected} />
        </li>
      ))}
    </ul>
  )
}

function RowBadge({ selected }: { dealId: string; selected: boolean }) {
  // Visibility is a plain `if`, per host.
  return selected ? <span>Selected</span> : null
}

export const badges = definePlugin({
  id: "badges",
  contributes: [DealRow.contribute({ order: 10, component: RowBadge })],
})
// [!endregion per-host]

// [!region empty]
// A host renders its children while nothing is *contributed*, which is not the
// same as nothing producing output. When every contribution returns `null` the
// container really is empty, so CSS covers the visual case.
export const emptyStateCss = `
.deal-actions:empty::before {
  content: "No actions available";
  color: var(--muted);
}
`
// [!endregion empty]

// [!region exclusive]
// "Exactly one owner" is a routing problem, not a slot problem. Keep the claim
// as an application field and resolve it into one table before render, so the
// refusal is reported instead of silently last-wins.
type ViewPlugin = PluginDefinition & {
  views?: Record<string, DealView>
}

export function resolveViews(plugins: readonly ViewPlugin[]) {
  const views = new Map<string, { pluginId: string; view: DealView }>()
  const refused: { pluginId: string; key: string; heldBy: string }[] = []

  for (const plugin of plugins) {
    for (const [key, view] of Object.entries(plugin.views ?? {})) {
      const owner = views.get(key)

      if (owner) {
        refused.push({ pluginId: plugin.id, key, heldBy: owner.pluginId })
        continue
      }

      views.set(key, { pluginId: plugin.id, view })
    }
  }

  return { views, refused }
}
// [!endregion exclusive]

// [!region inventory]
// There is no inventory helper because the manifest *is* data.
export function describeCatalog(plugins: readonly PluginDefinition[]) {
  return plugins.map((plugin) => ({
    id: plugin.id,
    slots: countBySlot(plugin.contributes ?? []),
  }))
}

function countBySlot(contributions: readonly Contribution[]) {
  const counts = new Map<string, number>()

  for (const contribution of contributions) {
    counts.set(contribution.slot, (counts.get(contribution.slot) ?? 0) + 1)
  }

  return Object.fromEntries(counts)
}
// [!endregion inventory]

// [!region visibility]
// There is no `when` predicate. A contribution decides for itself, and it is an
// ordinary component, so the condition can read anything a component can.
export function ArchiveAction({ stage }: { stage: string }) {
  const canArchive = useFeatureFlag("archive")

  if (stage !== "closed" || !canArchive) {
    return null
  }

  return <button type="button">Archive</button>
}
// [!endregion visibility]

// [!region toggle]
// Declarative: one filter, memoised so the index is not rebuilt per render.
// Runtime: uninstalling a feature is not rendering it.
export function Toggles({
  disabled,
  showDrafts,
}: {
  disabled: readonly string[]
  showDrafts: boolean
}) {
  const plugins = useMemo(
    () => CATALOG.filter((plugin) => !disabled.includes(plugin.id)),
    [disabled],
  )

  return (
    <PluginProvider plugins={plugins}>
      <AppShell />
      {showDrafts && <DraftBadge />}
    </PluginProvider>
  )
}
// [!endregion toggle]
