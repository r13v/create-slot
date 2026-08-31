// @jsx: react-jsx
"use client"

// [!region define]
import { defineSlot } from "create-slot/core"

export const DealActions = defineSlot<{ dealId: string; stage: string }>(
  "deal-actions",
)

// [!endregion define]

// [!region host]
import { SlotHost } from "create-slot"

export function DealToolbar({
  dealId,
  stage,
}: {
  dealId: string
  stage: string
}) {
  return (
    <div role="toolbar">
      <SlotHost slot={DealActions} props={{ dealId, stage }}>
        {/* The placeholder. It renders only while nothing is contributed. */}
        <span>No actions available</span>
      </SlotHost>
    </div>
  )
}
// [!endregion host]

// [!region contribution]
export function ArchiveAction({
  dealId,
  stage,
}: {
  dealId: string
  stage: string
}) {
  // Visibility is a plain `if`. There is no `when` predicate.
  if (stage !== "closed") {
    return null
  }

  return <button type="button">Archive {dealId}</button>
}

// [!endregion contribution]

// [!region fill]
// The runtime channel lives in the createSlot() façade: the factory's slot
// component registers its child while mounted, and the child reads the host's
// props through `useProps` — the element is written here but rendered where
// the host is.
import { createSlot } from "create-slot"

const LiveActions = createSlot<{ dealId: string }>()

export function LiveCallAction() {
  return (
    <LiveActions order={20}>
      <CallButton />
    </LiveActions>
  )
}

function CallButton() {
  const { dealId } = LiveActions.useProps()

  return <button type="button">Call about {dealId}</button>
}
// [!endregion fill]

// [!region multiple-hosts]
export function DealTable({
  deals,
}: {
  deals: { id: string; stage: string }[]
}) {
  return (
    <table>
      <tbody>
        {deals.map((deal) => (
          <tr key={deal.id}>
            <td>{deal.id}</td>
            <td>
              {/* One slot, one host per row: the same contribution renders in
                  every mounted host, each time with that host's own props. */}
              <SlotHost
                slot={DealActions}
                props={{ dealId: deal.id, stage: deal.stage }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
// [!endregion multiple-hosts]

// [!region contribute-data]
// `contribute` produces plain data under a required id — which is what a
// server render enumerates, and what `disable` and `override` address.
export const archive = DealActions.contribute("archive", {
  component: ArchiveAction,
})
// [!endregion contribute-data]
