import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react"

import type { ErasedComponent, PluginDefinition } from "./plugin"

export type PluginError = {
  pluginId: string
  slot: string
  error: unknown
}

export type RenderFailed = (
  state: PluginError & { reset: () => void },
) => ReactNode

/** One contribution, resolved against its plugin's position in the list. */
export type DeclaredEntry = {
  key: string
  pluginId: string
  slot: string
  component: ErasedComponent
  /** Priority. Kept on the entry so the host can rank it against a `Fill`. */
  order: number
  /** Position after sorting: the tie-break inside this channel. */
  seq: number
}

/** Every declared contribution, grouped and ranked once per plugin list. */
export type SlotIndex = Map<string, DeclaredEntry[]>

/** What a failing contribution is handled with. Read only when one fails. */
export type Handlers = {
  onError?: (error: PluginError) => void
  renderFailed?: RenderFailed
}

const NO_HANDLERS: Handlers = {}

/**
 * Two contexts, because they change for different reasons.
 *
 * The index changes when the plugin list does — rarely, and every host cares.
 * The handlers change whenever the application re-renders the provider with a
 * fresh arrow, which is how everyone writes them, and no host cares at all.
 * Sharing one context would have made every such render an app-wide re-render.
 */
const IndexContext = createContext<SlotIndex | null>(null)
const HandlersContext = createContext<Handlers>(NO_HANDLERS)
const PluginIdContext = createContext<string | null>(null)

// Keep the bare free variable and the whole diagnostic in one conditional:
// bundlers replace this exact expression and can remove the unused function,
// including its message, from production browser bundles.
const reportDuplicatePluginIds: (plugins: readonly PluginDefinition[]) => void =
  process.env.NODE_ENV !== "production"
    ? (plugins) => {
        const seen = new Set<string>()

        for (const plugin of plugins) {
          if (seen.has(plugin.id)) {
            console.error(
              `[create-slot] Duplicate plugin id "${plugin.id}": its contributions collide with the earlier plugin's React keys.`,
            )
          }

          seen.add(plugin.id)
        }
      }
    : () => {}

/**
 * Groups contributions by slot and sorts each group once.
 *
 * `order` is a real priority, not an array index: equal orders are a stable
 * tie, broken by the plugin's position in the list and then by the order of
 * declaration inside the plugin.
 */
function buildIndex(
  plugins: readonly PluginDefinition[],
): Map<string, DeclaredEntry[]> {
  type Ranked = DeclaredEntry & { pluginIndex: number; declaredIndex: number }

  const bySlot = new Map<string, Ranked[]>()

  plugins.forEach((plugin, pluginIndex) => {
    ;(plugin.contributes ?? []).forEach((contribution, declaredIndex) => {
      const group = bySlot.get(contribution.slot) ?? []

      group.push({
        key: `${plugin.id}#${declaredIndex}`,
        pluginId: plugin.id,
        slot: contribution.slot,
        component: contribution.component,
        order: contribution.order,
        seq: 0,
        pluginIndex,
        declaredIndex,
      })

      bySlot.set(contribution.slot, group)
    })
  })

  for (const group of bySlot.values()) {
    group.sort(
      (a, b) =>
        a.order - b.order ||
        a.pluginIndex - b.pluginIndex ||
        a.declaredIndex - b.declaredIndex,
    )

    group.forEach((entry, position) => {
      entry.seq = position
    })
  }

  return bySlot as Map<string, DeclaredEntry[]>
}

export type PluginProviderProps = {
  /**
   * The plugins to mount, already filtered by the application.
   *
   * The only SSR requirement of this library: the server and the client must
   * be given the same list, in the same order.
   */
  plugins: readonly PluginDefinition[]
  onError?: (error: PluginError) => void
  /** Rendered in place of a contribution that threw. */
  renderFailed?: RenderFailed
  children?: ReactNode
}

export function PluginProvider({
  plugins,
  onError,
  renderFailed,
  children,
}: PluginProviderProps) {
  // Built during render, kept in context: nothing is registered by an effect,
  // so the server produces the same markup as the client. Grouping is keyed on
  // `plugins` alone, so inline error callbacks do not rebuild it.
  const bySlot = useMemo(() => buildIndex(plugins), [plugins])

  const handlers = useMemo<Handlers>(
    () => ({ onError, renderFailed }),
    [onError, renderFailed],
  )

  // The library's only invariant about a manifest: ids are unique, because an
  // id becomes part of every contribution's React key. Anything else about a
  // plugin — names, capabilities, routes — is the application's to check.
  useEffect(() => {
    reportDuplicatePluginIds(plugins)
  }, [plugins])

  return (
    <IndexContext.Provider value={bySlot}>
      <HandlersContext.Provider value={handlers}>
        {children}
      </HandlersContext.Provider>
    </IndexContext.Provider>
  )
}

/**
 * The index a host reads. Null means no provider, which for a host that
 * tolerates one simply means no declared contributions.
 */
export function useSlotIndex(): SlotIndex | null {
  return useContext(IndexContext)
}

/** Read where a contribution is isolated, not where a slot is read. */
export function useHandlers(): Handlers {
  return useContext(HandlersContext)
}

/** Which plugin the surrounding contribution belongs to. */
export function usePluginId(): string {
  const id = useContext(PluginIdContext)

  if (id === null) {
    throw new Error(
      "[create-slot] 'usePluginId' called outside of a plugin contribution",
    )
  }

  return id
}

export function PluginIdProvider({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  return (
    <PluginIdContext.Provider value={id}>{children}</PluginIdContext.Provider>
  )
}
