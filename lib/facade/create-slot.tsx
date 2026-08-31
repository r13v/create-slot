import {
  cloneElement,
  createContext,
  type FC,
  isValidElement,
  type PropsWithChildren,
  type ReactElement,
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"

import { useStableProps } from "../internal/stable-props"
import { FillStore, getServerSnapshot } from "./store"

/**
 * The façade's product: calling it as JSX registers its child while mounted.
 *
 * These names are the ones 2.x published, so they stay as they are, in the
 * older wording: here a slot is the thing that contributes. The canonical
 * vocabulary is in CONTEXT.md, and why both survive is in
 * docs/adr/0001-two-vocabularies.md.
 */
export type RuntimeSlot<Props> = FC<{
  children: ReactElement
  /** Priority. Read once, when the fill mounts. */
  order?: number
}> & {
  /** Renders this factory's fills; its own children are the placeholder. */
  Host: FC<PropsWithChildren<Props>>
  /** The surrounding Host's props, read from a fill's element. */
  useProps(): Props
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

/** The test seam's route to a factory's store — module-private on purpose. */
const stores = new WeakMap<object, FillStore>()

/**
 * Factories are anonymous, so each needs a name of its own: React DevTools
 * and error component stacks would otherwise show indistinguishable frames
 * for every slot in the application.
 */
let nextSlotId = 0

/**
 * The runtime channel, whole and alone — SPA-only by design: the server and
 * hydration snapshots are always empty.
 *
 * Each factory owns a private store and context, shared with nothing. Two
 * factories can never exchange fills, two React roots using one factory
 * always do, and a duplicated copy of this module cannot split a store it
 * does not hold.
 */
export function createSlot<Props = unknown>(): RuntimeSlot<Props> {
  const store = new FillStore()
  const PropsContext = createContext<Props | null>(null)
  const name = `create-slot:${nextSlotId++}`

  const SlotComponent: RuntimeSlot<Props> = ({ order, children }) => {
    if (!children) {
      throw new Error("[create-slot] 'Slot' without children rendered")
    }

    // `cloneElement` stamps the key onto this child. Anything that is not a
    // single element reaches it as an element with no type, and React's own
    // report of that names a file the caller never wrote.
    if (!isValidElement(children)) {
      throw new Error(
        "[create-slot] A fill expects a single React element as its child",
      )
    }

    useFill(store, children, order)

    return null
  }

  const Host: RuntimeSlot<Props>["Host"] = (hostProps) => {
    const { children, ...rest } = hostProps
    const props = useStableProps(rest as unknown as Props & object)
    const entries = useSyncExternalStore(
      store.subscribe,
      store.getSnapshot,
      getServerSnapshot,
    )

    return (
      <PropsContext.Provider value={props as Props}>
        {entries.length === 0
          ? children
          : entries.map((entry) => (
              // The element renders here, not where its fill was written. If
              // it suspends, an outer boundary can otherwise hide that fill,
              // tear down its registration, reveal it, and repeat forever.
              <Suspense key={entry.key} fallback={null}>
                {entry.element}
              </Suspense>
            ))}
      </PropsContext.Provider>
    )
  }

  SlotComponent.displayName = name
  Host.displayName = `${name}.Host`

  // The nullable truth lives in the context; the façade can promise `Props`
  // because a fill's children only ever render inside one of its hosts.
  SlotComponent.Host = Host
  SlotComponent.useProps = () => useContext(PropsContext) as Props

  stores.set(SlotComponent, store)

  return SlotComponent
}

/**
 * @internal Test seam: what one factory's store still holds. Not part of the
 * public surface; the entry point does not re-export it, and the store is
 * reachable through a module-private WeakMap only.
 */
export function trackedFills<Props>(slot: RuntimeSlot<Props>): {
  entries: number
  listeners: number
} {
  const store = stores.get(slot)

  if (!store) {
    throw new Error("[create-slot] 'trackedFills' expects a createSlot factory")
  }

  return store.tracked()
}

/**
 * Registers `element` into the factory's store for as long as the caller is
 * mounted.
 *
 * `order` and the key are read once, on mount: a fill that re-renders with a
 * different `order` keeps its place, and a fill whose content changes keeps
 * its key, so React reconciles the new element against the old one instead
 * of remounting it.
 */
function useFill(
  store: FillStore,
  element: ReactElement,
  order?: number,
): void {
  const identity = useRef<{ key: string; order: number; seq: number } | null>(
    null,
  )

  identity.current ??= store.claim(order ?? 0)

  const { key, order: rank, seq } = identity.current
  const keyed = useMemo(() => cloneElement(element, { key }), [element, key])

  useIsomorphicLayoutEffect(() => {
    store.set({ key, order: rank, seq, element: keyed })
  }, [store, key, rank, seq, keyed])

  // Unmount only, so changed content never leaves a gap between two commits.
  useIsomorphicLayoutEffect(() => {
    return () => store.delete(key)
  }, [store, key])
}
