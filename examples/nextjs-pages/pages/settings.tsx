import { SettingsPage } from "crm-core"
import type { GetServerSideProps } from "next"

import { type CrmPageProps, loadCrmPageProps } from "../lib/crm-server"

export default function SettingsRoute() {
  return <SettingsPage />
}

export const getServerSideProps: GetServerSideProps<CrmPageProps> = async (
  context,
) => ({ props: await loadCrmPageProps(context) })
