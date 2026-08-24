// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  definePlugin,
  defineSlot,
  type PluginDefinition,
  type PluginError,
  PluginProvider,
  usePluginId,
} from "create-slot"

const Panels = defineSlot("panels")

declare const enabled: readonly PluginDefinition[]
declare function useStoreFor(pluginId: string): { title: string }
declare function MyErrorBoundary(props: {
  children: React.ReactNode
}): React.ReactNode
declare function RiskyWidget(): React.ReactNode
// [!endregion prelude]

// [!region provider]
export function App() {
  return (
    <PluginProvider
      plugins={enabled}
      onError={report}
      renderFailed={({ pluginId, error, reset }) => (
        <div role="alert">
          <p>
            {pluginId} could not render: {String(error)}
          </p>
          {/* There is no automatic reset. Recovery is this button. */}
          <button type="button" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    >
      <Panels.Host />
    </PluginProvider>
  )
}

function report({ pluginId, slot, error }: PluginError) {
  console.error(`[${pluginId}] failed in "${slot}"`, error)
}
// [!endregion provider]

// [!region plugin-id]
// The one thing only the library knows while a contribution renders: which
// plugin's entry the host is on. Per-plugin stores, loggers and settings
// namespaces all hang off it.
function ReportingCard() {
  const pluginId = usePluginId()
  const store = useStoreFor(pluginId)

  return <article>{store.title}</article>
}

export const reporting = definePlugin({
  id: "reporting",
  contributes: [Panels.contribute({ order: 10, component: ReportingCard })],
})
// [!endregion plugin-id]

// [!region runtime]
// Nothing wraps a runtime fill. It is your own code in your own tree, so bring
// your own boundary when it can throw.
export function RiskyChrome() {
  return (
    <Panels.Fill>
      <MyErrorBoundary>
        <RiskyWidget />
      </MyErrorBoundary>
    </Panels.Fill>
  )
}
// [!endregion runtime]
