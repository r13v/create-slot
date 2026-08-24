import {
  type ComponentType,
  createContext,
  isValidElement,
  memo,
  type ReactElement,
  type ReactNode,
  Suspense,
  useContext,
  useMemo,
  useRef,
} from "react"
import { PluginErrorBoundary } from "./error-boundary"
import type { Contribution, ErasedComponent } from "./plugin"
import {
  type DeclaredEntry,
  PluginIdProvider,
  useHandlers,
  useSlotIndex,
} from "./provider"
import { type RuntimeEntry, useRuntimeEntries, useRuntimeFill } from "./runtime"

export type ContributionSpec<Props> = {
  /** Priority, not an array index. Equal values are a stable tie. */
  order?: number
  /** Receives the host's props. Decides its own visibility with plain `if`. */
  component: ComponentType<Props>
}

export type SlotDefinition<Props extends object> = {
  name: string
  /**
   * Renders every contribution to this slot, in order.
   *
   * Its own `children` are the placeholder: they render only while nothing is
   * contributed. `children` belongs to the host, not to `Props`, so it is
   * never forwarded to a contribution.
   */
  Host: React.FC<Props & { children?: ReactNode }>
  /**
   * Declares a contribution up front. Resolved during render, which is what
   * makes it the channel a server render can see.
   */
  contribute(spec: ContributionSpec<Props>): Contribution
  /**
   * Contributes an element for as long as this component is mounted, from
   * wherever in the tree it is mounted.
   *
   * The runtime channel, and the reason it cannot be server-rendered: the
   * host has already rendered by the time a fill elsewhere in the tree gets
   * to announce itself. Prefer `contribute` unless the contribution genuinely
   * is not known up front.
   */
  Fill: React.FC<{ children: ReactElement; order?: number }>
  /** The surrounding host's props — how a `Fill` element reads them. */
  useProps(): Props | null
}

// `Record<never, never>`, not `Record<string, never>`: an index signature of
// `never` cannot coexist with the host's own `children`, and JSX still
// rejects an unknown attribute on a propless host either way.
export function defineSlot<Props extends object = Record<never, never>>(
  name: string,
): SlotDefinition<Props> {
  // The registry keys contributions by name, so an empty one is two slots
  // quietly sharing a bucket — the same invariant `definePlugin` guards.
  if (!name) {
    throw new Error("[create-slot] 'defineSlot' requires a non-empty name")
  }

  return buildSlot<Props>(name, true)
}

/**
 * @internal
 *
 * The `create-slot` façade needs a host that tolerates a missing provider,
 * because its API never had one. Everywhere else a missing provider is a
 * mistake worth reporting.
 */
export function buildSlot<Props extends object>(
  name: string,
  requireProvider: boolean,
): SlotDefinition<Props> {
  const PropsContext = createContext<Props | null>(null)

  const Host: SlotDefinition<Props>["Host"] = (hostProps) => {
    const { children, ...rest } = hostProps
    const props = useStableProps(rest as unknown as Props)
    const entries = useSlotEntries(name, requireProvider)

    return (
      <PropsContext.Provider value={props}>
        {entries.length === 0
          ? children
          : entries.map((merged) =>
              merged.kind === "declared" ? (
                <IsolatedContribution
                  key={merged.entry.key}
                  entry={merged.entry}
                  // Erased on the way in, restored on the way out; the slot's
                  // own types guaranteed the match when `contribute` was called.
                  props={props as unknown as ErasedProps}
                />
              ) : (
                merged.entry.element
              ),
            )}
      </PropsContext.Provider>
    )
  }

  Host.displayName = `${name}.Host`

  const Fill: SlotDefinition<Props>["Fill"] = ({ children, order }) => {
    // `cloneElement` stamps the key onto this child. Anything that is not a
    // single element reaches it as an element with no type, and React's own
    // report of that names a file the caller never wrote.
    if (!isValidElement(children)) {
      throw new Error(
        "[create-slot] A fill expects a single React element as its child",
      )
    }

    useRuntimeFill(name, children, order)

    return null
  }

  Fill.displayName = `${name}.Fill`

  return {
    name,
    Host,
    Fill,
    useProps: () => useContext(PropsContext),
    contribute: (spec) => ({
      slot: name,
      order: spec.order ?? 0,
      component: spec.component as unknown as ErasedComponent,
    }),
  }
}

type MergedEntry =
  | { kind: "declared"; entry: DeclaredEntry }
  | { kind: "runtime"; entry: RuntimeEntry }

const NO_ENTRIES: readonly MergedEntry[] = []

function useSlotEntries(
  name: string,
  requireProvider: boolean,
): readonly MergedEntry[] {
  const index = useSlotIndex()
  const runtime = useRuntimeEntries(name)
  const declared = index?.get(name)

  const entries = useMemo(() => merge(declared, runtime), [declared, runtime])

  if (requireProvider && !index) {
    throw new Error(
      "[create-slot] Slot host rendered outside of 'PluginProvider'",
    )
  }

  return entries
}

/** The host's props once they are erased, on their way to a contribution. */
type ErasedProps = Record<string, unknown>

const isolated = new WeakMap<ErasedComponent, ComponentType<ErasedProps>>()

/**
 * A contribution, as the host renders it: memoised, so that a host re-rendering
 * for someone else's sake does not re-render this feature's UI. The host hands
 * every contribution the same props it was given, and they are spread, so equal
 * values are enough for one to stand still.
 *
 * Cached on the author's own component rather than applied in `contribute`,
 * because a contribution is plain data — that is what a server render
 * enumerates — and because a stable identity is what keeps rebuilding the
 * index from remounting everything.
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
 * The host's props, held steady for as long as their values are.
 *
 * JSX builds a fresh props object every time the host's parent renders, so
 * identity alone says nothing about whether a contribution has new work to do.
 * Comparing by value is what lets a contribution stand still while the page
 * around it moves — and what makes `useProps` safe to read from a fill.
 *
 * A prop that is itself rebuilt each render still counts as new, exactly as it
 * would to `memo`: this makes an unchanged host free, never a changed one wrong.
 *
 * The ref is written during render, which a discarded render can leave holding
 * props that were never committed. It stays correct anyway: what comes back is
 * only ever an object whose values are `Object.is`-equal to the current props,
 * so an abandoned render can cost identity — never a stale value.
 */
function useStableProps<Props extends object>(next: Props): Props {
  const held = useRef(next)

  if (held.current !== next && !sameValues(held.current, next)) {
    held.current = next
  }

  return held.current
}

function sameValues(a: object, b: object): boolean {
  const keys = Object.keys(a)
  const otherKeys = Object.keys(b)

  if (keys.length !== otherKeys.length) {
    return false
  }

  // The names too, not the values alone: two props objects can carry the same
  // number of keys, and `undefined` under every key they do not share, while
  // being different props. Equal counts plus every name present on both sides
  // is the same key set — and `includes` over a handful of props costs less
  // than the set it would take to prove it in one pass.
  return keys.every(
    (key) =>
      otherKeys.includes(key) &&
      Object.is((a as ErasedProps)[key], (b as ErasedProps)[key]),
  )
}

/**
 * One ordered list out of the two channels.
 *
 * Both rank on the same `order`. A tie puts the declared contribution first: it is the one the server also rendered, so the position
 * it already occupies in the markup is the one it keeps.
 */
function merge(
  declared: readonly DeclaredEntry[] | undefined,
  runtime: readonly RuntimeEntry[],
): readonly MergedEntry[] {
  if (!declared || declared.length === 0) {
    return runtime.length === 0
      ? NO_ENTRIES
      : runtime.map((entry) => ({ kind: "runtime" as const, entry }))
  }

  const merged: MergedEntry[] = declared.map((entry) => ({
    kind: "declared" as const,
    entry,
  }))

  if (runtime.length === 0) {
    return merged
  }

  for (const entry of runtime) {
    merged.push({ kind: "runtime", entry })
  }

  return merged.sort(
    (a, b) =>
      a.entry.order - b.entry.order ||
      channelOf(a) - channelOf(b) ||
      a.entry.seq - b.entry.seq,
  )
}

function channelOf(merged: MergedEntry): number {
  return merged.kind === "declared" ? 0 : 1
}

/**
 * One contribution, wrapped in everything that keeps its failures its own.
 *
 * Memoised on `entry` and `props`, both of which the host holds steady, so a
 * host that re-renders for someone else's sake does not walk this subtree at
 * all. The failure handlers are read here rather than passed down: they are
 * new on every provider render and are wanted only once something throws.
 */
const IsolatedContribution = memo(function IsolatedContribution({
  entry,
  props,
}: {
  entry: DeclaredEntry
  /** The host's props, handed to the contribution as its own. */
  props: ErasedProps
}) {
  const { onError, renderFailed } = useHandlers()
  const Component = isolate(entry.component)

  return (
    <PluginIdProvider id={entry.pluginId}>
      <PluginErrorBoundary
        onError={(error) =>
          onError?.({ pluginId: entry.pluginId, slot: entry.slot, error })
        }
        renderFailed={
          renderFailed &&
          (({ error, reset }) =>
            renderFailed({
              pluginId: entry.pluginId,
              slot: entry.slot,
              error,
              reset,
            }))
        }
      >
        <Suspense fallback={null}>
          <Component {...props} />
        </Suspense>
      </PluginErrorBoundary>
    </PluginIdProvider>
  )
})
