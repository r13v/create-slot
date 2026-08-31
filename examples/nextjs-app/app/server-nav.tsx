import { ContributionBoundary } from "create-slot"
import { entriesOf, type Resolution } from "create-slot/core"
import { NavItems } from "crm-core/slots"

/**
 * A host with no client half: a SERVER component maps the resolution itself.
 *
 * `entriesOf` comes from the React-free core (callable here); each entry's
 * component is typed by the slot — no cast — and
 * `ContributionBoundary` (a "use client" export) gives every entry the same
 * failure isolation the default host would. The components are client
 * references; they hydrate under the shell's providers like any other
 * contribution, so `useDeals` and friends work inside them unchanged.
 */
export function ServerNav({
  resolution,
  current,
}: {
  resolution: Resolution
  /**
   * From the request (see proxy.ts), because a server component has no
   * `usePathname` — and static per request: a client navigation re-renders
   * the client hosts beside this one, never this markup. That trade IS the
   * demo: a host with no client half is exactly as live as the HTML it
   * shipped in.
   */
  current: string
}) {
  const entries = entriesOf(resolution, NavItems)

  return (
    <ul className="nav nav--server">
      {entries.map((entry) => {
        const Item = entry.component

        return (
          <li key={entry.key}>
            <ContributionBoundary
              pluginId={entry.pluginId}
              contributionId={entry.contributionId}
              slot={entry.slot}
            >
              <Item current={current} />
            </ContributionBoundary>
          </li>
        )
      })}
    </ul>
  )
}
