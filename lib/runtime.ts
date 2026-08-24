import {
  cloneElement,
  type ReactElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"

/**
 * A contribution that only became known when its `Fill` mounted somewhere else
 * in the tree.
 *
 * Data, like a declared contribution — except that the element already exists,
 * so the host renders it rather than a component, and it belongs to no plugin.
 */
export type RuntimeEntry = {
  /** Also the element's React key: assigned once, so content changes reconcile. */
  key: string
  /** Priority, read once on mount. Equal values are a stable tie. */
  order: number
  /** Registration sequence: the tie-break inside this channel. */
  seq: number
  element: ReactElement
}

const EMPTY: readonly RuntimeEntry[] = []

/**
 * The runtime half of the registry.
 *
 * The declarative index is built during render from the plugin list, which is
 * why a server render sees all of it. This store serves the other registration
 * mode,
 * where a fill is discovered by mounting a component elsewhere in the tree.
 *
 * `getServerSnapshot` always reports empty. React reads it on the server and
 * again during hydration, so server markup cannot contain fills that the first
 * client render — before later subtrees register — cannot reproduce. Effects
 * are where those subtrees register after hydration. The empty server snapshot
 * also makes one module-level store safe: concurrent server renders never read
 * each other's client registrations.
 */
class RuntimeStore {
  private bySlot = new Map<string, Map<string, RuntimeEntry>>()
  private snapshots = new Map<string, readonly RuntimeEntry[]>()
  private listeners = new Map<string, Set<() => void>>()

  set(slot: string, entry: RuntimeEntry): void {
    const entries = this.bySlot.get(slot) ?? new Map<string, RuntimeEntry>()

    entries.set(entry.key, entry)
    this.bySlot.set(slot, entries)
    this.invalidate(slot)
  }

  delete(slot: string, key: string): void {
    const entries = this.bySlot.get(slot)

    if (!entries?.delete(key)) {
      return
    }

    // Nothing is left to remember about an idle slot, and slot names can be
    // generated, so the last fill to leave takes the bucket with it.
    if (entries.size === 0) {
      this.bySlot.delete(slot)
    }

    this.invalidate(slot)
  }

  /** Cached per slot: `useSyncExternalStore` requires a stable snapshot. */
  getSnapshot(slot: string): readonly RuntimeEntry[] {
    const cached = this.snapshots.get(slot)

    if (cached) {
      return cached
    }

    const entries = this.bySlot.get(slot)

    // `EMPTY` is shared, so an idle slot is already stable without an entry of
    // its own in the cache.
    if (!entries?.size) {
      return EMPTY
    }

    const snapshot: readonly RuntimeEntry[] = [...entries.values()].sort(
      (a, b) => a.order - b.order || a.seq - b.seq,
    )

    this.snapshots.set(slot, snapshot)

    return snapshot
  }

  subscribe(slot: string, listener: () => void): () => void {
    const listeners = this.listeners.get(slot) ?? new Set<() => void>()

    listeners.add(listener)
    this.listeners.set(slot, listeners)

    return () => {
      listeners.delete(listener)

      // The identity check matters: a host that unsubscribes late holds a set
      // this slot has already replaced, and must not drop the live one.
      if (listeners.size === 0 && this.listeners.get(slot) === listeners) {
        this.listeners.delete(slot)
      }
    }
  }

  /** @internal Test seam: what the store still holds after a tree is gone. */
  tracked(): { entries: number; snapshots: number; listeners: number } {
    return {
      entries: this.bySlot.size,
      snapshots: this.snapshots.size,
      listeners: this.listeners.size,
    }
  }

  private invalidate(slot: string): void {
    this.snapshots.delete(slot)

    for (const listener of this.listeners.get(slot) ?? []) {
      listener()
    }
  }
}

const store = new RuntimeStore()

/**
 * @internal
 *
 * How much the module-level store still holds. Only the library's own tests
 * read it: a slot that no longer has a fill or a host must leave nothing
 * behind, because slot names can be generated per row.
 */
export function trackedSlots(): {
  entries: number
  snapshots: number
  listeners: number
} {
  return store.tracked()
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

function getServerSnapshot(): readonly RuntimeEntry[] {
  return EMPTY
}

/** What the host reads. Empty on the server and through hydration, always. */
export function useRuntimeEntries(slot: string): readonly RuntimeEntry[] {
  const source = useMemo(
    () => ({
      subscribe: (listener: () => void) => store.subscribe(slot, listener),
      getSnapshot: () => store.getSnapshot(slot),
    }),
    [slot],
  )

  return useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    getServerSnapshot,
  )
}

/**
 * Monotonic and never reset, so a fill that mounts later never sorts ahead of
 * one that mounted earlier — and no two live fills can share a React key.
 */
let nextFillId = 0

/**
 * Registers `element` into `slot` for as long as the caller is mounted.
 *
 * `order` and the key are read once, on mount: a fill that re-renders with a
 * different `order` keeps its place, and a fill whose content changes keeps its
 * key, so React reconciles the new element against the old one instead of
 * remounting it.
 */
export function useRuntimeFill(
  slot: string,
  element: ReactElement,
  order?: number,
): void {
  const identity = useRef<{
    key: string
    order: number
    seq: number
  } | null>(null)

  if (identity.current === null) {
    const seq = nextFillId++

    identity.current = { key: `runtime-${seq}`, order: order ?? 0, seq }
  }

  const { key, order: rank, seq } = identity.current
  const keyed = useMemo(() => cloneElement(element, { key }), [element, key])

  useIsomorphicLayoutEffect(() => {
    store.set(slot, { key, order: rank, seq, element: keyed })
  }, [slot, key, rank, seq, keyed])

  // Unmount only, so changed content never leaves a gap between two commits.
  useIsomorphicLayoutEffect(() => {
    return () => store.delete(slot, key)
  }, [slot, key])
}
