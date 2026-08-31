import type { ReactElement } from "react"

/**
 * A fill that registered while its component is mounted somewhere else in
 * the tree. The element already exists, so the host renders it directly.
 */
export type FillEntry = {
  /** Also the element's React key: assigned once, so content changes reconcile. */
  key: string
  /** Priority, read once on mount. Equal values are a stable tie. */
  order: number
  /** Registration sequence: the tie-break. */
  seq: number
  element: ReactElement
}

const EMPTY: readonly FillEntry[] = []

/** What React reads on the server and during hydration: nothing, always. */
export function getServerSnapshot(): readonly FillEntry[] {
  return EMPTY
}

/**
 * The runtime channel of ONE `createSlot()` factory.
 *
 * v3 kept a single module-level store keyed by slot name, which made every
 * loaded copy of the package a shared namespace — and a duplicated copy a
 * silent split brain. Here each factory closes over its own store: nothing
 * outlives the factory object, and nothing is shared that the application
 * did not share itself by exporting the factory.
 *
 * `getServerSnapshot` reports empty, so server markup cannot contain fills
 * that the first client render — before later subtrees register — cannot
 * reproduce. Effects are where those subtrees register after hydration.
 */
export class FillStore {
  private entries = new Map<string, FillEntry>()
  private snapshot: readonly FillEntry[] | null = null
  private listeners = new Set<() => void>()
  private nextSeq = 0

  /** Mint a registration identity: monotonic, never reset, never reused. */
  claim(order: number): { key: string; order: number; seq: number } {
    const seq = this.nextSeq++

    return { key: `fill-${seq}`, order, seq }
  }

  set(entry: FillEntry): void {
    this.entries.set(entry.key, entry)
    this.invalidate()
  }

  delete(key: string): void {
    if (this.entries.delete(key)) {
      this.invalidate()
    }
  }

  /** Cached: `useSyncExternalStore` requires a stable snapshot. */
  getSnapshot = (): readonly FillEntry[] => {
    if (this.entries.size === 0) {
      return EMPTY
    }

    this.snapshot ??= [...this.entries.values()].sort(
      (a, b) => a.order - b.order || a.seq - b.seq,
    )

    return this.snapshot
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  /** @internal Test seam: what the store still holds after a tree is gone. */
  tracked(): { entries: number; listeners: number } {
    return { entries: this.entries.size, listeners: this.listeners.size }
  }

  private invalidate(): void {
    this.snapshot = null

    for (const listener of this.listeners) {
      listener()
    }
  }
}
