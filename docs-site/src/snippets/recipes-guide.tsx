// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  type Contribution,
  definePlugin,
  defineSlot,
  type PluginDefinition,
  resolvePlugins,
  SlotHost,
  SlotProvider,
} from "create-slot"
import { lazy, type ReactNode, Suspense, useMemo } from "react"

import { StatusBar } from "./split-slots"

const DealRow = defineSlot<{ dealId: string; selected: boolean }>("deal-row")
const DealPanels = defineSlot<{ dealId: string }>("deal-panels")

type DealView = { label: string; filter: string }

declare function useFeatureFlag(name: string): boolean
declare const CATALOG: readonly PluginDefinition[]
declare function DraftBadge(): ReactNode
declare function AppShell(): ReactNode
declare function Skeleton(): ReactNode
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
          <SlotHost
            slot={DealRow}
            props={{ dealId: deal.id, selected: deal.selected }}
          />
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
  contributes: [
    DealRow.contribute("badge", { order: 10, component: RowBadge }),
  ],
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
// Declarative: resolve from the filtered list, or keep the list whole and
// `disable` by id — a typo in an id comes back as a diagnostic, not a silent
// no-op. Runtime: uninstalling a feature is not rendering it.
export function Toggles({
  disabled,
  showDrafts,
}: {
  disabled: readonly string[]
  showDrafts: boolean
}) {
  const resolution = useMemo(
    () => resolvePlugins(CATALOG, { disable: { plugins: disabled } }),
    [disabled],
  )

  return (
    <SlotProvider resolution={resolution}>
      <AppShell />
      {showDrafts && <DraftBadge />}
    </SlotProvider>
  )
}
// [!endregion toggle]

// [!region split-facade]
// A façade plugin is a module, so `lazy` moves all of it into its own chunk —
// the fills with it. A plugin that is off is never mounted, so the browser never
// requests its chunk.
const TelephonyPlugin = lazy(() => import("./telephony-plugin"))

export function Shell({ telephony }: { telephony: boolean }) {
  return (
    <>
      {telephony && (
        // The plugin renders nothing at its own position, so `null` is the
        // correct fallback here.
        <Suspense fallback={null}>
          <TelephonyPlugin />
        </Suspense>
      )}

      <footer>
        {/* No fill is registered while the chunk loads, so the host shows this
            placeholder instead of a gap. */}
        <StatusBar.Host>
          <span>Nothing has claimed the status bar</span>
        </StatusBar.Host>
      </footer>
    </>
  )
}
// [!endregion split-facade]

// [!region split-declared]
// Only the component is deferred. The manifest stays in the initial bundle,
// because the application has to read it to filter and to build its state.
// The provider's `Pending` fills the wait; an inner `Suspense` gives this one
// contribution a skeleton of its own.
const DealPanel = lazy(() => import("./panel"))

export const notes = definePlugin({
  id: "notes",
  contributes: [
    DealPanels.contribute("panel", {
      order: 10,
      component: (props) => (
        <Suspense fallback={<Skeleton />}>
          <DealPanel {...props} />
        </Suspense>
      ),
    }),
  ],
})
// [!endregion split-declared]

// [!region split-trap]
// This compiles, and it is shorter. One deferred contribution is still one
// entry, so the host skips its placeholder — and with no `Pending` set on the
// provider, the boundary renders `null` until the chunk arrives.
export const notesWithAGap = definePlugin({
  id: "notes-with-a-gap",
  contributes: [
    DealPanels.contribute("panel", { order: 10, component: DealPanel }),
  ],
})
// [!endregion split-trap]
