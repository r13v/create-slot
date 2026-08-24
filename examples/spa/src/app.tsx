import { useCallback, useState } from "react"

import { CrashTestPlugin } from "./plugins/faulty"
import { ForecastPlugin } from "./plugins/forecast"
import { PipelinePlugin } from "./plugins/pipeline"
import { TelephonyPlugin } from "./plugins/telephony"
import { AppShell } from "./shell"
import { PluginSwitches } from "./slots"

/**
 * The whole plugin system this app has.
 *
 * A plugin is a component that contributes; installing it is mounting it as a
 * child of the shell, and disabling it is not rendering it. There is no
 * manifest to declare, no array to filter and no provider to put around
 * anything — the tree is the registry.
 */
export function App() {
  const [off, setOff] = useState<ReadonlySet<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setOff((prev) => {
      const next = new Set(prev)

      if (!next.delete(id)) {
        next.add(id)
      }

      return next
    })
  }, [])

  const on = (id: string) => !off.has(id)

  return (
    <AppShell>
      {/* The app's own contribution: the switchboard in the sidebar. */}
      <Switchboard off={off} onToggle={toggle} />

      {on("pipeline") && <PipelinePlugin />}
      {on("forecast") && <ForecastPlugin />}
      {on("telephony") && <TelephonyPlugin />}
      {on("faulty") && <CrashTestPlugin />}
    </AppShell>
  )
}

/**
 * Labels, and nothing else: the checkboxes need names to draw, while mounting
 * the plugins above does not.
 */
const SWITCHES: readonly { id: string; title: string }[] = [
  { id: "pipeline", title: "Stages, deal actions, settings" },
  { id: "forecast", title: "Weighted forecast over the shell's deals" },
  { id: "telephony", title: "Click-to-call, with state of its own" },
  { id: "faulty", title: "A contribution that throws on demand" },
]

function Switchboard({
  off,
  onToggle,
}: {
  off: ReadonlySet<string>
  onToggle: (id: string) => void
}) {
  // One fill per checkbox, ranked by its place in the list: a component may
  // contribute as many times as it likes.
  return SWITCHES.map((plugin, at) => (
    <PluginSwitches key={plugin.id} order={at}>
      <label className="chip" data-plugin={plugin.id} title={plugin.title}>
        <input
          type="checkbox"
          checked={!off.has(plugin.id)}
          onChange={() => onToggle(plugin.id)}
        />
        {plugin.id}
      </label>
    </PluginSwitches>
  ))
}
