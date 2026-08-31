/**
 * A render that throws and is then retried concurrently reaches React's
 * `reportError`, which jsdom turns into a window error event and the runner
 * counts as an unhandled failure. Tests that provoke one own it: they collect
 * the events here, and `preventDefault` is what keeps the runner from
 * failing the file — do not "simplify" it away.
 */

let stop: (() => void) | null = null

/**
 * Starts collecting window error events into `into` (a fresh array by
 * default — pass your own to merge with other channels, as the SSR suite
 * does). Call `stopCollectingRecoveries` from `afterEach`.
 */
export function collectRecoveries(into: string[] = []): string[] {
  const onError = (event: ErrorEvent) => {
    event.preventDefault()
    into.push(String(event.error ?? event.message))
  }

  window.addEventListener("error", onError)
  stop = () => window.removeEventListener("error", onError)

  return into
}

export function stopCollectingRecoveries(): void {
  stop?.()
  stop = null
}
