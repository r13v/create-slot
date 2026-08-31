"use client"

import {
  definePlugin,
  defineSlot,
  type PluginDefinition,
  resolvePlugins,
  type SlotError,
  SlotHost,
  SlotProvider,
  useContribution,
} from "create-slot"
import { useCallback, useMemo, useState } from "react"

const NavMenu = defineSlot<{ current: string }>("demo-nav")
const Panels = defineSlot<{ dealId: string }>("demo-panels")

type DemoPlugin = PluginDefinition & { title: string }
type Report = { id: number; text: string }

let nextReportId = 0

/**
 * The registry, end to end: a manifest per feature, one Resolution, one
 * provider, two hosts, per-contribution identity through `useContribution`,
 * and one contribution that throws so the isolation is visible rather than
 * described.
 */
export function RegistryDemoClient() {
  const [enabledIds, setEnabledIds] = useState<readonly string[]>([
    "pipeline",
    "email",
  ])
  const [errors, setErrors] = useState<readonly Report[]>([])

  const resolution = useMemo(
    () =>
      resolvePlugins(
        CATALOG.filter((plugin) => enabledIds.includes(plugin.id)),
      ),
    [enabledIds],
  )

  const onError = useCallback(
    ({ pluginId, contributionId, slot, error }: SlotError) => {
      setErrors((current) => [
        ...current,
        // A counter, not the array index: the same message can be reported twice.
        {
          id: nextReportId++,
          text: `${pluginId}/${contributionId} threw in "${slot}": ${String(error)}`,
        },
      ])
    },
    [],
  )

  return (
    <div className="cs-demo">
      <div className="cs-demo-controls">
        <span className="cs-demo-label">Enabled plugins</span>
        {CATALOG.map((plugin) => (
          <label key={plugin.id} className="cs-toggle">
            <input
              type="checkbox"
              checked={enabledIds.includes(plugin.id)}
              onChange={(event) =>
                setEnabledIds((current) =>
                  event.target.checked
                    ? CATALOG.filter(
                        (candidate) =>
                          current.includes(candidate.id) ||
                          candidate.id === plugin.id,
                      ).map((candidate) => candidate.id)
                    : current.filter((id) => id !== plugin.id),
                )
              }
            />
            {plugin.title}
          </label>
        ))}
      </div>

      <SlotProvider resolution={resolution} onError={onError} Failed={Failed}>
        <div className="cs-demo-stage cs-demo-stage-split">
          <nav className="cs-panel" aria-label="Deal navigation">
            <p className="cs-panel-title">nav-menu host</p>
            <ul className="cs-list">
              <SlotHost slot={NavMenu} props={{ current: "/deals" }}>
                <li className="cs-item cs-item-placeholder">
                  No plugins installed
                </li>
              </SlotHost>
            </ul>
          </nav>

          <div className="cs-panel">
            <p className="cs-panel-title">panels host</p>
            <div className="cs-stack">
              <SlotHost slot={Panels} props={{ dealId: "ACME-4417" }}>
                <p className="cs-item-placeholder">Nothing to show</p>
              </SlotHost>
            </div>
          </div>
        </div>
      </SlotProvider>

      {errors.length > 0 && (
        <div className="cs-log">
          <div className="cs-log-head">
            <span className="cs-demo-label">onError</span>
            <button
              type="button"
              className="cs-button"
              onClick={() => setErrors([])}
            >
              Clear
            </button>
          </div>
          <ul>
            {errors.map((entry) => (
              <li key={entry.id}>{entry.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** A component, not a render prop: `Failed` names the failing contribution. */
function Failed({
  pluginId,
  contributionId,
  reset,
}: SlotError & { reset: () => void }) {
  return (
    <div className="cs-failed" role="alert">
      <span>
        {pluginId}/{contributionId} could not render.
      </span>
      <button type="button" className="cs-button" onClick={reset}>
        Try again
      </button>
    </div>
  )
}

function PipelineNavItem({ current }: { current: string }) {
  return (
    <li className="cs-item">
      Pipeline <span className="cs-muted">{current}</span>
    </li>
  )
}

function PipelineCard({ dealId }: { dealId: string }) {
  const { pluginId, contributionId } = useContribution()

  return (
    <article className="cs-card">
      <p className="cs-card-title">Pipeline</p>
      <p className="cs-muted">
        {dealId} · rendered as “{pluginId}/{contributionId}”
      </p>
    </article>
  )
}

function EmailNavItem() {
  return <li className="cs-item">Email</li>
}

function EmailCard({ dealId }: { dealId: string }) {
  return (
    <article className="cs-card">
      <p className="cs-card-title">Email</p>
      <p className="cs-muted">3 threads on {dealId}</p>
    </article>
  )
}

function BrokenCard(): never {
  throw new Error("this contribution always throws")
}

const CATALOG: readonly DemoPlugin[] = [
  definePlugin({
    id: "pipeline",
    title: "Pipeline",
    contributes: [
      NavMenu.contribute("nav-item", { order: 10, component: PipelineNavItem }),
      Panels.contribute("card", { order: 10, component: PipelineCard }),
    ],
  }),
  definePlugin({
    id: "email",
    title: "Email",
    contributes: [
      NavMenu.contribute("nav-item", { order: 20, component: EmailNavItem }),
      Panels.contribute("card", { order: 20, component: EmailCard }),
    ],
  }),
  definePlugin({
    id: "crash-test",
    title: "Crash test",
    contributes: [
      Panels.contribute("broken", { order: 30, component: BrokenCard }),
    ],
  }),
]
