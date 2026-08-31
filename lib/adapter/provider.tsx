import {
  type ComponentType,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react"

import type { Diagnostic, Resolution } from "../core/types"

/** Identifies a failing contribution to `onError` and `Failed`. */
export type SlotError = {
  pluginId: string
  contributionId: string
  slot: string
  error: unknown
}

/** Which contribution is rendering — what `useContribution` answers. */
export type ContributionInfo = {
  slot: string
  pluginId: string
  contributionId: string
}

/**
 * What a pending or failing contribution is handled with. Components, not
 * render functions: a component reference has stable identity and crosses an
 * RSC boundary, where a closure cannot.
 */
export type Handlers = {
  onError?: (error: SlotError) => void
  Failed?: ComponentType<SlotError & { reset: () => void }>
  Pending?: ComponentType<ContributionInfo>
}

const NO_HANDLERS: Handlers = {}

/**
 * Two contexts, because they change for different reasons.
 *
 * The resolution changes when the application resolves a new graph — rarely,
 * and every host cares. The handlers change whenever the provider re-renders
 * with a fresh arrow, which is how everyone writes them, and only a boundary
 * with something to show cares at all. Sharing one context would have made
 * every such render an app-wide re-render.
 */
const ResolutionContext = createContext<Resolution | null>(null)
const HandlersContext = createContext<Handlers>(NO_HANDLERS)
const ContributionContext = createContext<ContributionInfo | null>(null)

// Keep the bare free variable and the whole diagnostic in one conditional:
// bundlers replace this exact expression and can remove the unused function,
// including its messages, from production browser bundles. Deduped by
// content, because re-resolving an unchanged graph every render is legal and
// must not flood the console.
const reportDiagnostics: (diagnostics: readonly Diagnostic[]) => void =
  process.env.NODE_ENV !== "production"
    ? (() => {
        let lastReported = ""

        return (diagnostics: readonly Diagnostic[]) => {
          // A clean graph resets the dedup, so a defect that comes BACK after
          // being fixed is reported again — the console must not claim the
          // current graph is clean on stale evidence.
          if (diagnostics.length === 0) {
            lastReported = ""

            return
          }

          const serialized = JSON.stringify(diagnostics)

          if (serialized === lastReported) {
            return
          }

          lastReported = serialized

          for (const diagnostic of diagnostics) {
            console.error(`[create-slot] ${diagnostic.message}`)
          }
        }
      })()
    : () => {}

export type SlotProviderProps = {
  /**
   * The pre-resolved graph. Identity-compared: build it once, at module scope
   * or in `useMemo`. A fresh identity re-renders hosts and boundary shells;
   * memoized contribution components stand still either way.
   */
  resolution: Resolution
  /** Reported when a contribution throws. Inline arrows are free. */
  onError?: (error: SlotError) => void
  /** Rendered in place of a contribution that threw; `reset` retries it. */
  Failed?: ComponentType<SlotError & { reset: () => void }>
  /** Rendered while a deferred contribution loads. Unset keeps `null`. */
  Pending?: ComponentType<ContributionInfo>
  children?: ReactNode
}

/** Puts one Resolution in scope for every `SlotHost` below it. */
export function SlotProvider({
  resolution,
  onError,
  Failed,
  Pending,
  children,
}: SlotProviderProps): ReactElement {
  const handlers = useMemo<Handlers>(
    () => ({ onError, Failed, Pending }),
    [onError, Failed, Pending],
  )

  useEffect(() => {
    reportDiagnostics(resolution.diagnostics)
  }, [resolution])

  return (
    <ResolutionContext.Provider value={resolution}>
      <HandlersContext.Provider value={handlers}>
        {children}
      </HandlersContext.Provider>
    </ResolutionContext.Provider>
  )
}

/** @internal The resolution a host reads. A missing provider is a mistake. */
export function useResolution(): Resolution {
  const resolution = useContext(ResolutionContext)

  if (resolution === null) {
    throw new Error(
      "[create-slot] 'SlotHost' rendered outside of 'SlotProvider'",
    )
  }

  return resolution
}

/** @internal Read where a contribution is isolated, not where a slot is read. */
export function useHandlers(): Handlers {
  return useContext(HandlersContext)
}

/** @internal The contribution-identity context `ContributionBoundary` fills. */
export { ContributionContext }
