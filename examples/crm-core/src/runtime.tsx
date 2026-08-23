import { combineReducers, configureStore, type Reducer } from "@reduxjs/toolkit"
import { usePluginId } from "create-slot"
import {
  createContext,
  type ReactNode,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { Provider as ReduxProvider } from "react-redux"

import type { Command, CrmApi, CrmPlugin, DealView } from "./plugin"
import { dealsSlice } from "./state"

/**
 * Everything a plugin system needs that `create-slot` deliberately does not
 * provide: a store, saved views, commands, and the lifecycle around them.
 *
 * The rule the whole file follows: **assemble from the manifest before render,
 * never inject in an effect.** An effect does not run on the server, so
 * anything injected from one cannot be part of the HTML.
 */

/**
 * Slices come from the **catalog**, not from the enabled list: a store whose
 * shape changes when a plugin is toggled off cannot be preloaded by a server
 * that does not know the toggle yet.
 */
export function createCrmStore(
  catalog: readonly CrmPlugin[],
  preloadedState?: Record<string, unknown>,
) {
  const slices: Record<string, Reducer> = { deals: dealsSlice.reducer }

  for (const plugin of catalog) {
    if (plugin.reducer) {
      slices[plugin.id] = plugin.reducer
    }
  }

  return configureStore({
    reducer: combineReducers(slices),
    preloadedState,
  })
}

export type CrmStore = ReturnType<typeof createCrmStore>

/**
 * The server's half of that story is `crm-core/server`, not this file:
 * `preloadCrmState` produces the `preloadedState` above. It cannot live here,
 * because this module reaches React's client-only APIs, and a server component
 * may not import those.
 */

/** One instance per application instance — so one per request on the server. */
export function createPluginStores(
  catalog: readonly CrmPlugin[],
): Record<string, object> {
  const stores: Record<string, object> = {}

  for (const plugin of catalog) {
    const store = plugin.createStore?.()

    if (store) {
      stores[plugin.id] = store
    }
  }

  return stores
}

type ResolvedView = DealView & { key: string; pluginId: string }

/**
 * "Exactly one owner" is not a slot problem — it is a table the application
 * resolves from data, before render, and it can say who it refused.
 */
function resolveViews(plugins: readonly CrmPlugin[]) {
  const views = new Map<string, ResolvedView>()
  const conflicts: string[] = []

  for (const plugin of plugins) {
    for (const [key, view] of Object.entries(plugin.views ?? {})) {
      const owner = views.get(key)

      if (owner) {
        conflicts.push(
          `View "${key}" already belongs to "${owner.pluginId}", so "${plugin.id}" was refused`,
        )
      } else {
        views.set(key, { ...view, key, pluginId: plugin.id })
      }
    }
  }

  return { views, conflicts }
}

type Runtime = {
  api: CrmApi
  /** Everything installed, enabled or not — what a settings page enumerates. */
  catalog: readonly CrmPlugin[]
  stores: Record<string, object>
  views: Map<string, ResolvedView>
  viewConflicts: string[]
  commands: Command[]
}

const RuntimeContext = createContext<Runtime | null>(null)

function useRuntime(): Runtime {
  const runtime = useContext(RuntimeContext)

  if (!runtime) {
    throw new Error("CRM runtime hook used outside of 'CrmRuntime'")
  }

  return runtime
}

export const useCrmApi = (): CrmApi => useRuntime().api
export const useCatalog = (): readonly CrmPlugin[] => useRuntime().catalog
export const useCommands = (): Command[] => useRuntime().commands
export const useDealViews = () => useRuntime().views
export const useViewConflicts = (): string[] => useRuntime().viewConflicts

/** A plugin's own ephemeral store, addressed by the id the library hands out. */
export function usePluginStore<T extends object>(): T {
  const { stores } = useRuntime()
  const id = usePluginId()
  const store = stores[id]

  if (!store) {
    throw new Error(`Plugin "${id}" did not declare 'createStore'`)
  }

  return store as T
}

export function CrmRuntime({
  plugins,
  catalog,
  store,
  stores,
  navigate,
  notify,
  children,
}: {
  /** The enabled plugins, in the order the server and the client agreed on. */
  plugins: readonly CrmPlugin[]
  /** Everything installed. The store's shape and the inventory come from this. */
  catalog: readonly CrmPlugin[]
  store: CrmStore
  stores: Record<string, object>
  navigate: (href: string) => void
  notify: (message: string) => void
  children: ReactNode
}) {
  const [commands, setCommands] = useState<Command[]>([])

  // `startTransition` is not decoration: `setup` runs while the page is still
  // hydrating, and an urgent update reaching a boundary that has not hydrated
  // yet makes React throw the server's markup away and re-render it.
  const registerCommand = useCallback((command: Command) => {
    startTransition(() => setCommands((prev) => [...prev, command]))

    return () => {
      startTransition(() =>
        setCommands((prev) => prev.filter((it) => it !== command)),
      )
    }
  }, [])

  const api = useMemo<CrmApi>(
    () => ({
      navigate,
      notify,
      dispatch: store.dispatch,
      registerCommand,
    }),
    [navigate, notify, store, registerCommand],
  )

  const { views, conflicts } = useMemo(() => resolveViews(plugins), [plugins])

  // The lifecycle the library does not own: eight lines, and client-only by
  // construction, because effects do not run on the server.
  useEffect(() => {
    const disposers = plugins.map((plugin) => plugin.setup?.(api))

    return () => {
      for (const dispose of disposers) {
        dispose?.()
      }
    }
  }, [plugins, api])

  const runtime = useMemo<Runtime>(
    () => ({ api, catalog, stores, views, viewConflicts: conflicts, commands }),
    [api, catalog, stores, views, conflicts, commands],
  )

  return (
    <ReduxProvider store={store}>
      <RuntimeContext.Provider value={runtime}>
        {children}
      </RuntimeContext.Provider>
    </ReduxProvider>
  )
}
