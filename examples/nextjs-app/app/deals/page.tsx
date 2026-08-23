import { DealsPage } from "../../lib/crm-pages"

/**
 * `getServerSideProps` becomes an `await` — and a saved view is still applied on
 * the server, by the table the app resolved from the plugins' manifests, so the
 * filtered list is in the HTML.
 */
export default async function DealsRoute({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams

  return <DealsPage view={view} />
}
