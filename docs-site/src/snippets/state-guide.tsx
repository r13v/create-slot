// @jsx: react-jsx
"use client"

// [!region prelude]
import { definePlugin, type PluginDefinition, usePluginId } from "create-slot"
import { startTransition, useEffect } from "react"

type Reducer = (state: unknown, action: { type: string }) => unknown
type CrmApi = { registerCommand(name: string, run: () => void): void }

declare function pipelineReducer(
  state: unknown,
  action: { type: string },
): unknown
declare function fetchPipelineState(): Promise<unknown>
declare function createStore(
  reducers: Record<string, Reducer>,
  preloaded: object,
): object
declare function useCrmStore<T>(pluginId: string): T
// [!endregion prelude]

// [!region plugin-type]
// The manifest is open data. `definePlugin` is generic over its argument, so
// your own fields keep their types — the library reads `id` and `contributes`
// and nothing else.
export type CrmPlugin = PluginDefinition & {
  title: string
  reducer?: Reducer
  /** Server-side initial state for this plugin's slice. */
  preload?: () => Promise<unknown> | unknown
  createStore?: () => object
  setup?: (api: CrmApi) => (() => void) | void
}

// [!endregion plugin-type]

// [!region redux]
// Combine slices from the *catalog*, not from the enabled list: a store whose
// shape depends on a toggle cannot be preloaded.
export const pipeline = definePlugin({
  id: "pipeline",
  title: "Pipeline",
  reducer: pipelineReducer,
  preload: () => fetchPipelineState(),
}) satisfies CrmPlugin

export function buildStore(catalog: readonly CrmPlugin[], preloaded: object) {
  const reducers = Object.fromEntries(
    catalog.flatMap((plugin) =>
      plugin.reducer ? [[plugin.id, plugin.reducer]] : [],
    ),
  )

  return createStore(reducers, preloaded)
}
// [!endregion redux]

// [!region mobx]
// One store instance per application instance — on the server, per request.
// A contribution finds its own through `usePluginId`, the only thing the
// library owes it.
export const telephony = definePlugin({
  id: "telephony",
  title: "Telephony",
  createStore: () => ({ activeCall: null as string | null }),
}) satisfies CrmPlugin

export function CallIndicator() {
  const store = useCrmStore<{ activeCall: string | null }>(usePluginId())

  return <span>{store.activeCall ?? "Idle"}</span>
}
// [!endregion mobx]

// [!region setup]
// `setup` runs in an effect, so whatever it registers is absent from server
// markup by construction. Wrap the registration in `startTransition`: an urgent
// update reaching a boundary that has not hydrated yet makes React throw away
// the streamed HTML.
export function useSetup(plugins: readonly CrmPlugin[], api: CrmApi) {
  useEffect(() => {
    let teardown: (() => void)[] = []

    startTransition(() => {
      teardown = plugins.flatMap((plugin) => plugin.setup?.(api) ?? [])
    })

    return () => {
      for (const dispose of teardown) {
        dispose()
      }
    }
  }, [plugins, api])
}
// [!endregion setup]

// [!region satisfies]
// `satisfies` checks the shape without widening it, so the literal keeps its
// exact type and the application can read a field back without a cast.
export const reporting = definePlugin({
  id: "reporting",
  title: "Reporting",
}) satisfies CrmPlugin

export const reportingTitle = reporting.title
// [!endregion satisfies]
