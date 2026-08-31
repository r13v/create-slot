import {
  type ComponentType,
  memo,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from "react"
import { entriesOf } from "../core/resolve"
import type { ErasedComponent, ResolvedEntry, Slot } from "../core/types"
import {
  type ErasedProps,
  sameValues,
  useStableProps,
} from "../internal/stable-props"
import { ContributionBoundary } from "./boundary"
import { propsContextOf } from "./hooks"
import { useResolution } from "./provider"

/** One entry as `renderEntries` receives it: identity plus the finished node. */
export type HostEntry = {
  /** `${pluginId}/${contributionId}` — already stamped on `node`; key your own wrapper with it. */
  key: string
  pluginId: string
  contributionId: string
  order: number
  /** The contribution, already wrapped: memo, error boundary, Suspense, identity. */
  node: ReactNode
}

export type SlotHostProps<Props extends object> = {
  /** Which slot to render. */
  slot: Slot<Props>
  /** Placeholder: rendered only while nothing is contributed. */
  children?: ReactNode
  /**
   * Full-ownership escape hatch: called with every entry — with zero too —
   * and owns layout, wrappers and the empty state. `children` is then
   * ignored. Key your wrappers with `entry.key`, never with an array index.
   */
  renderEntries?: (entries: readonly HostEntry[]) => ReactNode
  // NoInfer: the slot is the single source of Props — otherwise a literal in
  // the props bag widens during inference ("row" -> string) and the two
  // inference sites fight each other.
} & (Record<never, never> extends Props
  ? { props?: NoInfer<Props> }
  : { props: NoInfer<Props> })

// Frozen: it is one shared object handed to every props-less host app-wide,
// and a contribution mutating it must throw at the culprit, not bleed state
// across unrelated slots.
const EMPTY_PROPS: object = Object.freeze({})

// One conditional, one bare free variable: bundlers strip the whole warning
// from production builds. See provider.tsx for the pattern.
const warnConflictingRender: (slot: string) => void =
  process.env.NODE_ENV !== "production"
    ? (slot) => {
        console.error(
          `[create-slot] The host for "${slot}" was given both 'renderEntries' and children; children are ignored while 'renderEntries' is set.`,
        )
      }
    : () => {}

/**
 * Renders every contribution to a slot, in resolved order.
 *
 * The default layout is itself expressed through the `renderEntries` path, so
 * the two ways of rendering a host cannot drift apart. Host props are
 * value-held, so contributions stand still while the page around them moves.
 */
export function SlotHost<Props extends object>(
  hostProps: SlotHostProps<Props>,
): ReactElement {
  const { slot, children, renderEntries } = hostProps
  // The conditional `props` type collapses inside the implementation; one
  // widening read, then everything downstream is ordinary.
  const given = (hostProps as { props?: Props }).props
  const props = useStableProps((given ?? EMPTY_PROPS) as Props)

  const resolution = useResolution()
  const entries = useStableEntries(entriesOf(resolution, slot))
  const PropsContext = propsContextOf(slot)

  const hostEntries = useMemo<readonly HostEntry[]>(
    () =>
      entries.map((entry) => ({
        key: entry.key,
        pluginId: entry.pluginId,
        contributionId: entry.contributionId,
        order: entry.order,
        node: (
          <IsolatedEntry
            key={entry.key}
            // The same erasure `Resolution.slots` already holds this entry
            // under; `entriesOf` restored Props for the caller, not for us.
            entry={entry as unknown as ResolvedEntry}
            // Erased on the way in, restored on the way out; the slot's own
            // types guaranteed the match when `contribute` was called.
            props={props as unknown as ErasedProps}
          />
        ),
      })),
    [entries, props],
  )

  // `false` is what `{cond && <X/>}` leaves behind; React renders it as
  // nothing, so it is not a conflicting placeholder.
  const conflicting =
    renderEntries !== undefined && children != null && children !== false

  useEffect(() => {
    if (conflicting) {
      warnConflictingRender(slot.name)
    }
  }, [conflicting, slot.name])

  const render =
    renderEntries ??
    ((list: readonly HostEntry[]) =>
      list.length === 0 ? children : list.map((entry) => entry.node))

  return (
    <PropsContext.Provider value={props}>
      {render(hostEntries)}
    </PropsContext.Provider>
  )
}

const isolated = new WeakMap<ErasedComponent, ComponentType<ErasedProps>>()

/**
 * A contribution, as the host renders it: memoised, so that a host
 * re-rendering for someone else's sake does not re-render this feature's UI.
 *
 * Cached on the author's own component rather than applied in `contribute`,
 * because a contribution is plain data — that is what a server render
 * enumerates — and because a stable component identity keeps a rebuilt
 * Resolution from remounting it.
 */
function isolate(component: ErasedComponent): ComponentType<ErasedProps> {
  const cached = isolated.get(component)

  if (cached) {
    return cached
  }

  // Restores what `contribute` erased; the slot's own types guaranteed the match.
  const wrapped = memo(
    component as unknown as ComponentType<ErasedProps>,
  ) as unknown as ComponentType<ErasedProps>

  isolated.set(component, wrapped)

  return wrapped
}

/**
 * Content equality for a resolved entry: `resolvePlugins` mints fresh entry
 * objects on every call, and an application is allowed to call it inline on
 * every render, so identity says nothing. Same identity fields, same rank,
 * same component — same entry.
 */
function sameEntry(a: ResolvedEntry, b: ResolvedEntry): boolean {
  return (
    a.key === b.key &&
    a.pluginId === b.pluginId &&
    a.contributionId === b.contributionId &&
    a.order === b.order &&
    a.component === b.component
  )
}

function sameEntries(
  a: readonly ResolvedEntry[],
  b: readonly ResolvedEntry[],
): boolean {
  return (
    a.length === b.length &&
    a.every((entry, index) => sameEntry(entry, b[index] as ResolvedEntry))
  )
}

/**
 * The slot's entries, held steady by content.
 *
 * `resolvePlugins` mints a fresh array on every call, and an application is
 * allowed to call it inline on every render — so without this, every mounted
 * host would rebuild its `HostEntry` objects and elements each render only
 * for the entry comparator to prove nothing changed. Holding the array by
 * value lets the `useMemo` above bail on identity instead. Discarded-render
 * safe for the same reason `useStableProps` is: what comes back is only ever
 * an array whose entries are content-equal to the current ones.
 */
function useStableEntries<Props extends object>(
  next: readonly ResolvedEntry<Props>[],
): readonly ResolvedEntry<Props>[] {
  const held = useRef(next)

  if (
    held.current !== next &&
    !sameEntries(
      held.current as readonly ResolvedEntry[],
      next as readonly ResolvedEntry[],
    )
  ) {
    held.current = next
  }

  return held.current
}

/**
 * One contribution, wrapped in everything that keeps its failures its own.
 *
 * Compared by entry content and props values — both of which a rebuilt
 * Resolution reproduces — so a host that re-renders for someone else's sake,
 * or over a graph resolved inline, does not walk this subtree at all.
 */
const IsolatedEntry = memo(
  function IsolatedEntry({
    entry,
    props,
  }: {
    entry: ResolvedEntry
    /** The host's props, handed to the contribution as its own. */
    props: ErasedProps
  }) {
    const Component = isolate(entry.component)

    return (
      <ContributionBoundary
        pluginId={entry.pluginId}
        contributionId={entry.contributionId}
        slot={entry.slot}
      >
        <Component {...props} />
      </ContributionBoundary>
    )
  },
  (prev, next) =>
    sameEntry(prev.entry, next.entry) &&
    (prev.props === next.props || sameValues(prev.props, next.props)),
)
