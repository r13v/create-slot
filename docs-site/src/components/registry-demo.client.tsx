"use client"

import {
  definePlugin,
  defineSlot,
  type PluginDefinition,
  type PluginError,
  PluginProvider,
  usePluginId,
} from "create-slot"
import { useCallback, useMemo, useState } from "react"

const NavMenu = defineSlot<{ current: string }>("demo-nav")
const Panels = defineSlot<{ dealId: string }>("demo-panels")

type DemoPlugin = PluginDefinition & { title: string }
type Report = { id: number; text: string }

let nextReportId = 0

/**
 * The registry, end to end: a manifest per feature, one provider, two slots,
 * per-plugin identity through `usePluginId`, and one contribution that throws
 * so the isolation is visible rather than described.
 */
export function RegistryDemoClient() {
  const [enabledIds, setEnabledIds] = useState<readonly string[]>([
    "pipeline",
    "email",
  ])
  const [errors, setErrors] = useState<readonly Report[]>([])

  const plugins = useMemo(
    () => CATALOG.filter((plugin) => enabledIds.includes(plugin.id)),
    [enabledIds],
  )

  const onError = useCallback(({ pluginId, slot, error }: PluginError) => {
    setErrors((current) => [
      ...current,
      // A counter, not the array index: the same message can be reported twice.
      {
        id: nextReportId++,
        text: `${pluginId} threw in "${slot}": ${String(error)}`,
      },
    ])
  }, [])

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

      <PluginProvider
        plugins={plugins}
        onError={onError}
        renderFailed={({ pluginId, reset }) => (
          <div className="cs-failed" role="alert">
            <span>{pluginId} could not render.</span>
            <button type="button" className="cs-button" onClick={reset}>
              Try again
            </button>
          </div>
        )}
      >
        <div className="cs-demo-stage cs-demo-stage-split">
          <nav className="cs-panel" aria-label="Deal navigation">
            <p className="cs-panel-title">nav-menu host</p>
            <ul className="cs-list">
              <NavMenu.Host current="/deals">
                <li className="cs-item cs-item-placeholder">
                  No plugins installed
                </li>
              </NavMenu.Host>
            </ul>
          </nav>

          <div className="cs-panel">
            <p className="cs-panel-title">panels host</p>
            <div className="cs-stack">
              <Panels.Host dealId="ACME-4417">
                <p className="cs-item-placeholder">Nothing to show</p>
              </Panels.Host>
            </div>
          </div>
        </div>
      </PluginProvider>

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

function PipelineNavItem({ current }: { current: string }) {
  return (
    <li className="cs-item">
      Pipeline <span className="cs-muted">{current}</span>
    </li>
  )
}

function PipelineCard({ dealId }: { dealId: string }) {
  const pluginId = usePluginId()

  return (
    <article className="cs-card">
      <p className="cs-card-title">Pipeline</p>
      <p className="cs-muted">
        {dealId} · rendered for plugin “{pluginId}”
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
      NavMenu.contribute({ order: 10, component: PipelineNavItem }),
      Panels.contribute({ order: 10, component: PipelineCard }),
    ],
  }),
  definePlugin({
    id: "email",
    title: "Email",
    contributes: [
      NavMenu.contribute({ order: 20, component: EmailNavItem }),
      Panels.contribute({ order: 20, component: EmailCard }),
    ],
  }),
  definePlugin({
    id: "crash-test",
    title: "Crash test",
    contributes: [Panels.contribute({ order: 30, component: BrokenCard })],
  }),
]
