// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  createSlot,
  definePlugin,
  defineSlot,
  type PluginDefinition,
  resolvePlugins,
  type SlotError,
  SlotHost,
  SlotProvider,
  useContribution,
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
// `Failed` is a component, not a render prop: its identity is stable, and a
// component reference crosses an RSC boundary where a closure cannot.
function PluginFailed({
  pluginId,
  error,
  reset,
}: SlotError & { reset: () => void }) {
  return (
    <div role="alert">
      <p>
        {pluginId} could not render: {String(error)}
      </p>
      {/* There is no automatic reset. Recovery is this button. */}
      <button type="button" onClick={reset}>
        Try again
      </button>
    </div>
  )
}

export function App() {
  return (
    <SlotProvider
      resolution={resolvePlugins(enabled)}
      onError={report}
      Failed={PluginFailed}
    >
      <SlotHost slot={Panels} />
    </SlotProvider>
  )
}

function report({ pluginId, contributionId, slot, error }: SlotError) {
  console.error(`[${pluginId}/${contributionId}] failed in "${slot}"`, error)
}
// [!endregion provider]

// [!region plugin-id]
// The one thing only the library knows while a contribution renders: which
// contribution it is. Per-plugin stores, loggers and settings namespaces all
// hang off `useContribution().pluginId`.
function ReportingCard() {
  const { pluginId } = useContribution()
  const store = useStoreFor(pluginId)

  return <article>{store.title}</article>
}

export const reporting = definePlugin({
  id: "reporting",
  contributes: [
    Panels.contribute("card", { order: 10, component: ReportingCard }),
  ],
})
// [!endregion plugin-id]

// [!region runtime]
// A façade fill gets only a null-fallback Suspense boundary from its host. It
// is your own code in your own tree, so bring your own error boundary when it
// can throw.
const StatusItems = createSlot()

export function RiskyChrome() {
  return (
    <StatusItems>
      <MyErrorBoundary>
        <RiskyWidget />
      </MyErrorBoundary>
    </StatusItems>
  )
}
// [!endregion runtime]
