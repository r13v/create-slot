"use client"

import { money, PluginCard } from "crm-core"
import { createContext, type ReactNode, Suspense, use, useContext } from "react"

// Type-only, so the client bundle never pulls in the query itself.
import type { Insight } from "../lib/insight"

/**
 * The client half of the plugin — see `insights.tsx` for the manifest and the
 * idea. The card's number comes from a server query that takes over a second.
 * Nothing waits for it: the root layout starts the query and passes the
 * *promise* through this context, the card reads it with `use()`, and the
 * `Suspense` boundary the host already puts around every contribution turns
 * that into one hole in the first chunk of HTML.
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

export function AttainmentCard() {
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
      {/* The contribution brings its own fallback; the provider-level Pending
          would be the other way to fill this hole. */}
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
