import { type Context, createContext, useContext } from "react"

import type { Slot } from "../core/types"
import { ContributionContext, type ContributionInfo } from "./provider"

/**
 * Well-known symbols, shared through the global symbol registry: if a bundle
 * ends up with two copies of this adapter (ESM/CJS interop), both copies
 * still meet on the same anchors, so a host from one copy and a
 * `useSlotProps` from the other resolve one context.
 */
const PROPS_CONTEXT = Symbol.for("create-slot.props-context")
const FROZEN_REGISTRY = Symbol.for("create-slot.props-context-registry")

type Carrier = {
  [PROPS_CONTEXT]?: Context<object | null>
}

type GlobalCarrier = {
  [FROZEN_REGISTRY]?: WeakMap<object, Context<object | null>>
}

/** Where a frozen descriptor's context lives: it cannot carry one itself. */
function frozenRegistry(): WeakMap<object, Context<object | null>> {
  const host = globalThis as GlobalCarrier

  host[FROZEN_REGISTRY] ??= new WeakMap()

  return host[FROZEN_REGISTRY]
}

/**
 * @internal
 *
 * The props context of one slot, cached on the descriptor itself.
 *
 * Lazy and idempotent: the first caller attaches the context, every later
 * caller — a StrictMode double render, a discarded render, the other bundle
 * copy — reads the one already there. The descriptor is the anchor because a
 * module-level WeakMap would be one per adapter copy, and the copies must
 * agree. The property is non-enumerable, so spreading a descriptor clones the
 * data and never the cache — a clone is a different anchor. A descriptor the
 * application froze cannot carry the cache at all; those fall back to a
 * WeakMap on `globalThis`, anchored through the same symbol registry.
 */
export function propsContextOf<Props extends object>(
  slot: Slot<Props>,
): Context<Props | null> {
  const carrier = slot as unknown as Carrier
  let context = carrier[PROPS_CONTEXT]

  if (!context) {
    if (Object.isExtensible(slot)) {
      context = createContext<object | null>(null)

      Object.defineProperty(slot, PROPS_CONTEXT, {
        value: context,
        enumerable: false,
        configurable: true,
      })
    } else {
      const registry = frozenRegistry()
      context = registry.get(slot)

      if (!context) {
        context = createContext<object | null>(null)
        registry.set(slot, context)
      }
    }
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
