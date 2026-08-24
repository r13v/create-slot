"use client"

import { definePlugin, defineSlot, PluginProvider } from "create-slot"
import { useMemo, useState } from "react"

const Toolbar = defineSlot("demo-toolbar")

function Button({ label }: { label: string }) {
  return (
    <button type="button" className="cs-chip">
      {label}
    </button>
  )
}

function SearchButton() {
  return <Button label="Search" />
}

function FiltersButton() {
  return <Button label="Filters" />
}

function ExportButton() {
  return <Button label="Export" />
}

const DECLARED = [
  { id: "search", label: "Search", component: SearchButton },
  { id: "filters", label: "Filters", component: FiltersButton },
  { id: "export", label: "Export", component: ExportButton },
] as const

/**
 * Two lessons in one stage: a declared contribution's `order` is read on every
 * render, and a runtime fill's `order` is read once, on mount.
 */
export function OrderingDemoClient() {
  const [orders, setOrders] = useState<Record<string, number>>({
    search: 10,
    filters: 20,
    export: 30,
  })
  const [fillOrder, setFillOrder] = useState(15)
  const [fillKey, setFillKey] = useState(0)
  const [fillMounted, setFillMounted] = useState(true)

  const plugins = useMemo(
    () =>
      DECLARED.map(({ id, component }) =>
        definePlugin({
          id,
          contributes: [
            Toolbar.contribute({ order: orders[id] ?? 0, component }),
          ],
        }),
      ),
    [orders],
  )

  return (
    <div className="cs-demo">
      <PluginProvider plugins={plugins}>
        <div className="cs-demo-stage">
          <div className="cs-panel">
            <p className="cs-panel-title">Toolbar host</p>
            <div className="cs-row">
              <Toolbar.Host />
            </div>
          </div>
        </div>

        {fillMounted && (
          <Toolbar.Fill key={fillKey} order={fillOrder}>
            <span className="cs-chip cs-chip-runtime">Unsaved (fill)</span>
          </Toolbar.Fill>
        )}
      </PluginProvider>

      <div className="cs-demo-controls">
        {DECLARED.map(({ id, label }) => (
          <label key={id} className="cs-number">
            {label}
            <input
              type="number"
              step={5}
              value={orders[id]}
              onChange={(event) =>
                setOrders((current) => ({
                  ...current,
                  [id]: Number(event.target.value),
                }))
              }
            />
          </label>
        ))}
      </div>

      <div className="cs-demo-controls">
        <label className="cs-number">
          Fill order
          <input
            type="number"
            step={5}
            value={fillOrder}
            onChange={(event) => setFillOrder(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          className="cs-button"
          onClick={() => setFillKey((key) => key + 1)}
        >
          Remount the fill
        </button>
        <button
          type="button"
          className="cs-button"
          onClick={() => setFillMounted((mounted) => !mounted)}
        >
          {fillMounted ? "Unmount the fill" : "Mount the fill"}
        </button>
      </div>

      <p className="cs-demo-note">
        Change a declared order and the toolbar reorders immediately. Change the
        fill's order and nothing moves — it was read once, on mount. Remount it
        to apply the new value.
      </p>
    </div>
  )
}
