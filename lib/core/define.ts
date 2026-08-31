import type { ErasedComponent, PluginDefinition, Slot } from "./types"

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

/**
 * Creates a slot descriptor. Pure data — safe to import from server modules.
 *
 * The graph is keyed by name, so an empty one would be two slots quietly
 * sharing a bucket — the same invariant `definePlugin` guards. A contribution
 * id, by contrast, is validated by the resolver: a plugin's typo must surface
 * as a diagnostic, not take the application down at import time.
 */
export function defineSlot<Props extends object = Record<never, never>>(
  name: string,
): Slot<Props> {
  if (!name) {
    throw new Error("[create-slot] 'defineSlot' requires a non-empty name")
  }

  return {
    name,
    contribute: (id, spec) => ({
      slot: name,
      id,
      order: spec.order ?? 0,
      // Erased on the way in, restored on the way out; this slot's own types
      // guaranteed the match when `contribute` was called.
      component: spec.component as unknown as ErasedComponent,
    }),
    override: (target, patch) => ({
      slot: name,
      target,
      order: patch.order,
      component: patch.component as unknown as ErasedComponent | undefined,
    }),
  }
}
