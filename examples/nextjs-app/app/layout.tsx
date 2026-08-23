import "crm-core/crm.css"

import type { ReactNode } from "react"

import { CrmShell } from "../components/crm-shell"
import { loadCrmRequest } from "../lib/crm-server"

export const metadata = {
  title: "Northwind CRM — Next.js app router",
}

/**
 * The whole integration, in one server component.
 *
 * It decides which plugins this request gets, loads their state, starts the one
 * slow query without waiting for it, and hands all three to the client shell as
 * plain props. Everything below is server-rendered on the way out and hydrated
 * on the way in — the store included, which is why it survives navigation.
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const { enabled, preloadedState, insight } = await loadCrmRequest()

  return (
    <html lang="en">
      <body>
        <CrmShell
          enabled={enabled}
          preloadedState={preloadedState}
          insight={insight}
        >
          {children}
        </CrmShell>
      </body>
    </html>
  )
}
