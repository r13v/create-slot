import { type ReactElement, type ReactNode, Suspense, useMemo } from "react"

import { PluginErrorBoundary } from "../error-boundary"
import {
  ContributionContext,
  type ContributionInfo,
  useHandlers,
} from "./provider"

/**
 * The per-contribution isolation wrapper: contribution identity, error
 * boundary, Suspense. Exported so hand-rolled hosts — including RSC server
 * components mapping a Resolution — keep the same failure semantics as the
 * default host.
 *
 * Handlers are read here, lazily, from their own context: they are new on
 * every provider render and are wanted only once something suspends or
 * throws, so an inline arrow re-renders this thin shell and nothing below it.
 */
export function ContributionBoundary({
  pluginId,
  contributionId,
  slot,
  children,
}: ContributionInfo & { children: ReactNode }): ReactElement {
  const { onError, Failed, Pending } = useHandlers()

  const info = useMemo<ContributionInfo>(
    () => ({ slot, pluginId, contributionId }),
    [slot, pluginId, contributionId],
  )

  return (
    <ContributionContext.Provider value={info}>
      <PluginErrorBoundary
        onError={(error) =>
          onError?.({ pluginId, contributionId, slot, error })
        }
        renderFailed={
          Failed &&
          (({ error, reset }) => (
            <Failed
              pluginId={pluginId}
              contributionId={contributionId}
              slot={slot}
              error={error}
              reset={reset}
            />
          ))
        }
      >
        <Suspense
          fallback={
            Pending ? (
              <Pending
                pluginId={pluginId}
                contributionId={contributionId}
                slot={slot}
              />
            ) : null
          }
        >
          {children}
        </Suspense>
      </PluginErrorBoundary>
    </ContributionContext.Provider>
  )
}
