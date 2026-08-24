import { DealPage } from "../../../lib/crm-pages"

export default async function DealRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <DealPage id={id} />
}
