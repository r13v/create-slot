import { DealsPage } from "crm-core"
import type { GetServerSideProps } from "next"

import { type CrmPageProps, loadCrmPageProps } from "../../lib/crm-server"

/** `null` rather than `undefined`: page props have to survive JSON. */
type Props = CrmPageProps & { view: string | null }

export default function DealsRoute({ view }: Props) {
  return <DealsPage view={view ?? undefined} />
}

/**
 * A saved view is applied on the server, by the table the app resolved from the
 * plugins' manifests — so the filtered list is in the HTML.
 */
export const getServerSideProps: GetServerSideProps<Props> = async (
  context,
) => ({
  props: {
    ...(await loadCrmPageProps(context)),
    view: typeof context.query.view === "string" ? context.query.view : null,
  },
})
