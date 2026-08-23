// @jsx: react-jsx
"use client"

// [!region define]
import { defineSlot } from "create-slot"

export const DealActions = defineSlot<{ dealId: string; stage: string }>(
  "deal-actions",
)
// [!endregion define]

// [!region host]
export function DealToolbar({
  dealId,
  stage,
}: {
  dealId: string
  stage: string
}) {
  return (
    <div role="toolbar">
      <DealActions.Host dealId={dealId} stage={stage}>
        {/* The placeholder. It renders only while nothing is contributed. */}
        <span>No actions available</span>
      </DealActions.Host>
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
export function LiveCallAction() {
  return (
    <DealActions.Fill order={20}>
      <CallButton />
    </DealActions.Fill>
  )
}

function CallButton() {
  // A fill reads the host's props through `useProps`, because the element is
  // written here but rendered where the host is. `null` means no host above.
  const props = DealActions.useProps()

  if (!props) {
    return null
  }

  return <button type="button">Call about {props.dealId}</button>
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
              <DealActions.Host dealId={deal.id} stage={deal.stage} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
// [!endregion multiple-hosts]

// [!region contribute-data]
// `contribute` produces plain data — which is what a server render enumerates.
export const archive = DealActions.contribute({ component: ArchiveAction })
// [!endregion contribute-data]
