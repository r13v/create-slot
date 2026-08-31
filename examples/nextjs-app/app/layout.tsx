import "crm-core/crm.css"

import { resolvePlugins } from "create-slot/core"
import type { ReactNode } from "react"

import { CrmShell } from "../components/crm-shell"
import { enabledPlugins } from "../lib/catalog"
import { loadCrmRequest } from "../lib/crm-server"
import { ServerNav } from "./server-nav"

export const metadata = {
  title: "Northwind CRM — Next.js app router",
}

/**
 * The whole integration, in one server component — tier 2 of the RSC story.
 *
 * It decides which plugins this request gets, RESOLVES the slot graph right
 * here (`resolvePlugins` is React-free, and the manifests keep their
 * components in "use client" modules, so the whole Resolution is
 * serializable), loads state, starts the one slow query without waiting for
 * it, and hands everything to the client shell as plain props. Everything
 * below is server-rendered on the way out and hydrated on the way in.
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const { enabled, current, preloadedState, insight } = await loadCrmRequest()

  // The Resolution itself crosses the client boundary: metadata plus client
  // references, nothing else.
  const resolution = resolvePlugins(enabledPlugins(enabled))

  return (
    <html lang="en">
      <body>
        <CrmShell
          enabled={enabled}
          resolution={resolution}
          preloadedState={preloadedState}
          insight={insight}
          serverNav={<ServerNav resolution={resolution} current={current} />}
        >
          {children}
        </CrmShell>
      </body>
    </html>
  )
}
