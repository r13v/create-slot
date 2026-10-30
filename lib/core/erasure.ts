import type { ComponentType } from "react"

import type { ErasedComponent, ResolvedEntry } from "./types"

/**
 * Every unsafe cast the registry makes, in one file.
 *
 * One invariant pays for all of them: a component reaches the graph only
 * through `slot.contribute()`, where the slot's own `Props` still checked it.
 * After that one graph holds every slot's contributions together, so the
 * props type cannot survive in the data — it is restored on the way out, by
 * the descriptor that erased it.
 *
 * These are `as unknown as` rather than a direct `as` because `ComponentType`
 * is a union with `ComponentClass`, whose `defaultProps` is `Partial<Props>`
 * — invariant, where the call signature is contravariant. Neither form is
 * assignable to the other, so TypeScript refuses the one-step conversion the
 * call signatures alone would have allowed.
 */

/** A typed component on its way into the graph. */
export function eraseComponent<Props extends object>(
  component: ComponentType<Props>,
): ErasedComponent {
  return component as unknown as ErasedComponent
}

/** A component on its way out, typed by the descriptor that erased it. */
export function restoreComponent<Props extends object>(
  component: ErasedComponent,
): ComponentType<Props> {
  return component as unknown as ComponentType<Props>
}

/** One slot's entries, typed by the descriptor they were addressed to. */
export function restoreEntries<Props extends object>(
  entries: readonly ResolvedEntry[],
): readonly ResolvedEntry<Props>[] {
  return entries as unknown as readonly ResolvedEntry<Props>[]
}

/**
 * The inverse of `restoreEntries`, for one entry handed back to machinery
 * that holds every slot's at once. Sound on its own — `ResolvedEntry<Props>`
 * is a subtype of the erased form — but written out so the step is visible.
 */
export function eraseEntry<Props extends object>(
  entry: ResolvedEntry<Props>,
): ResolvedEntry {
  return entry as unknown as ResolvedEntry
}
