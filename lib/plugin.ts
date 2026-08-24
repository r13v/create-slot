import type { ComponentType } from "react"

/**
 * A contribution component with its props erased, so one index can hold the
 * contributions of every slot. The host restores the slot's props type.
 */
export type ErasedComponent = ComponentType<never>

/**
 * One contribution, produced by `slot.contribute()`.
 *
 * Data, not an element: the host renders it, so the whole list is known
 * synchronously — on the server too.
 */
export type Contribution = {
  slot: string
  order: number
  component: ErasedComponent
}

/**
 * Everything the library needs to know about a plugin, and nothing else.
 *
 * Names, descriptions, capability keys, routes, reducers, lifecycle — none of
 * that is read here, so none of it belongs here. Declare those on your own
 * plugin type; `definePlugin` is generic over its argument, so they keep their
 * types:
 *
 * ```ts
 * type AppPlugin = PluginDefinition & {
 *   title?: string
 *   routes?: Record<string, ComponentType>
 *   setup?: (api: AppApi) => (() => void) | void
 * }
 * ```
 */
export type PluginDefinition = {
  /** Unique. It becomes part of each contribution's React key. */
  id: string
  contributes?: readonly Contribution[]
}

/**
 * Identity plus a non-empty id check — and the one place where the plugin
 * system is discoverable in a codebase.
 */
export function definePlugin<T extends PluginDefinition>(definition: T): T {
  if (!definition.id) {
    throw new Error("[create-slot] 'definePlugin' requires a non-empty id")
  }

  return definition
}
