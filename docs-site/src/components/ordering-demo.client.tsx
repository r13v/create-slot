"use client"

import {
  createSlot,
  definePlugin,
  defineSlot,
  resolvePlugins,
  SlotHost,
  SlotProvider,
} from "create-slot"
import { useMemo, useState } from "react"

const Toolbar = defineSlot("demo-toolbar")
const StatusItems = createSlot()

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
 * Two lessons in one stage: a declared contribution's `order` is data — a new
 * Resolution re-ranks it immediately — while a façade fill's `order` is read
 * once, on mount.
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

  const resolution = useMemo(
    () =>
      resolvePlugins(
        DECLARED.map(({ id, component }) =>
          definePlugin({
            id,
            contributes: [
              Toolbar.contribute("button", {
                order: orders[id] ?? 0,
                component,
              }),
            ],
          }),
        ),
      ),
    [orders],
  )

  return (
    <div className="cs-demo">
      <SlotProvider resolution={resolution}>
        <div className="cs-demo-stage">
          <div className="cs-panel">
            <p className="cs-panel-title">Registry host — declared orders</p>
            <div className="cs-row">
              <SlotHost slot={Toolbar} />
            </div>
          </div>

          <div className="cs-panel">
            <p className="cs-panel-title">Façade host — one runtime fill</p>
            <div className="cs-row">
              <StatusItems.Host>
                <span className="cs-item-placeholder">No fill mounted</span>
              </StatusItems.Host>
            </div>
          </div>
        </div>

        {/* A permanent fill so the runtime one has something to rank against. */}
        <StatusItems order={20}>
          <span className="cs-chip">Saved</span>
        </StatusItems>

        {fillMounted && (
          <StatusItems key={fillKey} order={fillOrder}>
            <span className="cs-chip cs-chip-runtime">Unsaved (fill)</span>
          </StatusItems>
        )}
      </SlotProvider>

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
        Change a declared order and the registry host reorders on the next
        Resolution — immediately. Change the fill's order and nothing moves —
        the façade read it once, on mount. Remount the fill to apply the new
        value.
      </p>
    </div>
  )
}
