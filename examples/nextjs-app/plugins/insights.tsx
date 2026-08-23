"use client"

import { definePlugin } from "create-slot"
import { type CrmPlugin, DashboardWidgets, money, PluginCard } from "crm-core"
import { createContext, type ReactNode, Suspense, use, useContext } from "react"

import { INSIGHTS_ID } from "../lib/crm-request"
// Type-only, so the client bundle never pulls in the query itself.
import type { Insight } from "../lib/insight"

/**
 * This example's own plugin — the SPA example adds a faulty one, and this one
 * adds the thing only the app router can do.
 *
 * The card's number comes from a server query that takes over a second. Nothing
 * waits for it: the root layout starts the query and passes the *promise*
 * through this context, the card reads it with `use()`, and the `Suspense`
 * boundary the host already puts around every contribution turns that into one
 * hole in the first chunk of HTML. Every other contribution ships immediately.
 */

const InsightContext = createContext<Promise<Insight> | null>(null)

export function InsightProvider({
  insight,
  children,
}: {
  insight: Promise<Insight>
  children: ReactNode
}) {
  return (
    <InsightContext.Provider value={insight}>
      {children}
    </InsightContext.Provider>
  )
}

export const insights: CrmPlugin = definePlugin({
  id: INSIGHTS_ID,
  title: "Insights",
  description:
    "One dashboard card whose number comes from a slow server query, streamed in rather than waited for.",

  contributes: [
    DashboardWidgets.contribute({ order: 5, component: AttainmentCard }),
  ],
})

function AttainmentCard() {
  const insight = useContext(InsightContext)

  if (!insight) {
    return (
      <PluginCard title="Quarter attainment">
        <p className="muted">No server started the query for this shell.</p>
      </PluginCard>
    )
  }

  return (
    <PluginCard title="Quarter attainment">
      {/* The contribution brings its own fallback: the host's boundary uses
          `null`, because the library has no `pending` prop to guess with. */}
      <Suspense fallback={<p className="muted">asking the warehouse…</p>}>
        <Attainment insight={insight} />
      </Suspense>
    </PluginCard>
  )
}

function Attainment({ insight }: { insight: Promise<Insight> }) {
  const { quota, attained } = use(insight)
  const share = Math.round((attained / quota) * 100)

  return (
    <>
      <p className="kpi">
        {money(attained)}{" "}
        <small>
          of {money(quota)} — {share}%
        </small>
      </p>

      <div className="meter" role="img" aria-label={`${share}% of quota`}>
        <span style={{ width: `${share}%` }} />
      </div>
    </>
  )
}
