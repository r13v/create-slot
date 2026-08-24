import { DealPage } from "crm-core"
import type { GetServerSideProps } from "next"

import { type CrmPageProps, loadCrmPageProps } from "../../lib/crm-server"

type Props = CrmPageProps & { id: string }

export default function DealRoute({ id }: Props) {
  return <DealPage id={id} />
}

export const getServerSideProps: GetServerSideProps<Props> = async (
  context,
) => ({
  props: {
    ...(await loadCrmPageProps(context)),
    id: String(context.params?.id ?? ""),
  },
})
