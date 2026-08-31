import { useRef } from "react"

/** A props object once it is erased, on its way to a contribution or fill. */
export type ErasedProps = Record<string, unknown>

/**
 * The host's props, held steady for as long as their values are.
 *
 * JSX builds a fresh props object every time the host's parent renders, so
 * identity alone says nothing about whether a contribution has new work to
 * do. Comparing by value is what lets a contribution stand still while the
 * page around it moves — and what makes reading them from a context safe.
 *
 * The ref is written during render, which a discarded render can leave
 * holding props that were never committed. It stays correct anyway: what
 * comes back is only ever an object whose values are `Object.is`-equal to
 * the current props, so an abandoned render can cost identity — never a
 * stale value.
 */
export function useStableProps<Props extends object>(next: Props): Props {
  const held = useRef(next)

  if (held.current !== next && !sameValues(held.current, next)) {
    held.current = next
  }

  return held.current
}

export function sameValues(a: object, b: object): boolean {
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
