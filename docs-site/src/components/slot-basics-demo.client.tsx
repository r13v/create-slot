"use client"

import { createSlot } from "create-slot"
import { useReducer, useState } from "react"

const Menu = createSlot<{
  current: string
  visits: number
  visit: () => void
}>()

/**
 * The point of the demo: the two features below are never imported by the
 * sidebar, and the sidebar is never imported by them. Installing a feature is
 * mounting it.
 */
export function SlotBasicsDemoClient() {
  const [pricing, setPricing] = useState(true)
  const [changelog, setChangelog] = useState(false)
  const [route, setRoute] = useState("/pricing")

  return (
    <div className="cs-demo">
      <div className="cs-demo-controls">
        <span className="cs-demo-label">Installed features</span>
        <label className="cs-toggle">
          <input
            type="checkbox"
            checked={pricing}
            onChange={(event) => setPricing(event.target.checked)}
          />
          Pricing
        </label>
        <label className="cs-toggle">
          <input
            type="checkbox"
            checked={changelog}
            onChange={(event) => setChangelog(event.target.checked)}
          />
          Changelog
        </label>
        <span className="cs-demo-divider" />
        <span className="cs-demo-label">Route</span>
        <select
          className="cs-select"
          value={route}
          onChange={(event) => setRoute(event.target.value)}
        >
          <option value="/pricing">/pricing</option>
          <option value="/changelog">/changelog</option>
          <option value="/">/</option>
        </select>
      </div>

      <div className="cs-demo-stage">
        <Sidebar current={route} />
      </div>

      {/* Mounted anywhere. Neither one renders where it is written. */}
      {pricing && <PricingFeature />}
      {changelog && <ChangelogFeature />}
    </div>
  )
}

function Sidebar({ current }: { current: string }) {
  const [visits, visit] = useReducer((count: number) => count + 1, 0)

  return (
    <nav className="cs-panel" aria-label="Docs navigation">
      <p className="cs-panel-title">Sidebar host</p>
      <ul className="cs-list">
        <li className="cs-item">Overview</li>
        <Menu.Host current={current} visits={visits} visit={visit}>
          <li className="cs-item cs-item-placeholder">No features installed</li>
        </Menu.Host>
      </ul>
    </nav>
  )
}

function PricingFeature() {
  return (
    <Menu order={10}>
      <MenuItem label="Pricing" href="/pricing" />
    </Menu>
  )
}

function ChangelogFeature() {
  return (
    <Menu order={20}>
      <MenuItem label="Changelog" href="/changelog" />
    </Menu>
  )
}

function MenuItem({ label, href }: { label: string; href: string }) {
  // The host's props, read from inside the fill.
  const { current, visits, visit } = Menu.useProps()
  const active = current === href

  return (
    <li className="cs-item" aria-current={active ? "page" : undefined}>
      <span className={active ? "cs-item-active" : undefined}>{label}</span>
      <button type="button" className="cs-chip" onClick={visit}>
        host clicks: {visits}
      </button>
    </li>
  )
}
