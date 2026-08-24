import type { Dispatch, Reducer } from "@reduxjs/toolkit"
import type { PluginDefinition } from "create-slot"

import type { Deal } from "./data"

export type Command = {
  id: string
  title: string
  run: () => void
}

/** What the shell lends a plugin. Everything here is the application's own. */
export type CrmApi = {
  navigate: (href: string) => void
  notify: (message: string) => void
  dispatch: Dispatch
  registerCommand: (command: Command) => () => void
}

/** A saved view of the deal list, declared as data so the server can apply it. */
export type DealView = {
  title: string
  match: (deal: Deal) => boolean
}

/**
 * The library's manifest — `id` and `contributes` — plus the fields this CRM
 * invented for itself.
 *
 * `create-slot` reads none of the rest: state, data loading, saved views and
 * commands are application concerns, and the manifest is open data the
 * application is free to extend. `definePlugin` is generic over its argument,
 * so these keep their types.
 */
export type CrmPlugin = PluginDefinition & {
  title: string
  description: string
  /** A redux slice, combined from the catalog before render (see `runtime`). */
  reducer?: Reducer
  /** That slice's server-side initial state. Runs per request, never in an effect. */
  preload?: () => Promise<unknown> | unknown
  /** Ephemeral, client-only state. One instance per application instance. */
  createStore?: () => object
  /** Saved views for the deal list. Resolved into one table before render. */
  views?: Record<string, DealView>
  /**
   * Non-UI contributions. Client-only by construction: it runs in an effect.
   *
   * The return type is React's own `useEffect` shape — a cleanup function or
   * nothing. `undefined` in place of `void` would force every `setup` that
   * cleans nothing up to return a value.
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: React's useEffect cleanup shape
  setup?: (api: CrmApi) => (() => void) | void
}
