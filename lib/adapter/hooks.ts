import { type Context, createContext, useContext } from "react"

import type { Slot } from "../core/types"
import { ContributionContext, type ContributionInfo } from "./provider"

/**
 * One props context per slot descriptor, created on first use.
 *
 * A module-level WeakMap, not a cache stored on the descriptor: a descriptor
 * is pure data the docs invite you to freeze and to import from a server
 * module, and a WeakMap needs neither an extensible object nor a hidden
 * property on one. Spreading a descriptor yields a different object and so a
 * different context, which is correct — a clone is a different slot.
 *
 * Earlier versions anchored this through `Symbol.for`, so that two copies of
 * the adapter in one bundle would still meet in a single context. That
 * defended a state the library cannot reach: a host finds its provider
 * through `ResolutionContext`, an ordinary module-level context, so two
 * copies already fail with "'SlotHost' rendered outside of 'SlotProvider'"
 * long before a props context is read. One copy is what the build
 * guarantees — `splitting: true`, re-checked by the chunk-sharing smokes —
 * and that is the one place the guarantee belongs.
 */
const contexts = new WeakMap<object, Context<object | null>>()

/** @internal The props context of one slot. Idempotent; safe during render. */
export function propsContextOf<Props extends object>(
  slot: Slot<Props>,
): Context<Props | null> {
  let context = contexts.get(slot)

  if (!context) {
    context = createContext<object | null>(null)
    contexts.set(slot, context)
  }

  return context as Context<Props | null>
}

/** The nearest host's props for this slot; null outside one. */
export function useSlotProps<Props extends object>(
  slot: Slot<Props>,
): Props | null {
  return useContext(propsContextOf(slot))
}

/** The identity of the contribution rendering now. Throws outside one. */
export function useContribution(): ContributionInfo {
  const info = useContext(ContributionContext)

  if (info === null) {
    throw new Error(
      "[create-slot] 'useContribution' called outside of a plugin contribution",
    )
  }

  return info
}
