import type {
  Diagnostic,
  ErasedComponent,
  PluginDefinition,
  Resolution,
  ResolvedEntry,
  ResolveOptions,
  Slot,
} from "./types"

/** Shared, so an idle slot costs no allocation — and stays `Object.is`-equal. */
const NO_ENTRIES: readonly ResolvedEntry[] = []

/** A contribution while it still remembers where in the input it came from. */
type Ranked = {
  key: string
  pluginId: string
  contributionId: string
  slot: string
  order: number
  component: ErasedComponent
  pluginIndex: number
  declaredIndex: number
}

/**
 * The whole registry as one pure, synchronous, deterministic function.
 *
 * Inputs are never mutated; problems come back as diagnostics, never as
 * throws and never as silent drops. The same plugins and options produce a
 * deep-equal Resolution every time, which is the entire SSR contract: give
 * the server and the client the same inputs and the graphs cannot diverge.
 */
export function resolvePlugins(
  plugins: readonly PluginDefinition[],
  options?: ResolveOptions,
): Resolution {
  const diagnostics: Diagnostic[] = []

  const disabledPlugins = new Set(options?.disable?.plugins ?? [])
  const disabledContributions = new Set(options?.disable?.contributions ?? [])

  // Everything that exists, enabled or not: a disable/override target outside
  // these sets is a typo worth reporting, not a silent no-op.
  const seenPluginIds = new Set<string>()
  const seenFullIds = new Set<string>()

  const ranked = new Map<string, Ranked>()

  plugins.forEach((plugin, pluginIndex) => {
    if (seenPluginIds.has(plugin.id)) {
      diagnostics.push({
        code: "duplicate-plugin-id",
        message: `Duplicate plugin id "${plugin.id}": every contribution id it carries collides with the earlier plugin's.`,
        pluginId: plugin.id,
      })
    }

    seenPluginIds.add(plugin.id)

    // Manifest defects are reported even for a disabled plugin: the typo
    // exists regardless of what this application chose to enable.
    const enabled = !disabledPlugins.has(plugin.id)

    plugin.contributes?.forEach((contribution, declaredIndex) => {
      if (!contribution.id || contribution.id.includes("/")) {
        diagnostics.push({
          code: "invalid-contribution-id",
          message: `Contribution id "${contribution.id}" in plugin "${plugin.id}" must be non-empty and must not contain "/".`,
          pluginId: plugin.id,
          contributionId: contribution.id,
          slot: contribution.slot,
        })

        return
      }

      const key = `${plugin.id}/${contribution.id}`

      if (seenFullIds.has(key)) {
        diagnostics.push({
          code: "duplicate-contribution-id",
          message: `Duplicate contribution id "${key}": the first declaration wins, this one is dropped.`,
          pluginId: plugin.id,
          contributionId: contribution.id,
          slot: contribution.slot,
        })

        return
      }

      seenFullIds.add(key)

      // Disabling is the integrator's intent, not a defect — no diagnostic.
      if (!enabled || disabledContributions.has(key)) {
        return
      }

      ranked.set(key, {
        key,
        pluginId: plugin.id,
        contributionId: contribution.id,
        slot: contribution.slot,
        order: contribution.order,
        component: contribution.component,
        pluginIndex,
        declaredIndex,
      })
    })
  })

  for (const id of disabledPlugins) {
    if (!seenPluginIds.has(id)) {
      diagnostics.push({
        code: "unknown-disable-target",
        message: `disable.plugins names "${id}", which no plugin in the list carries.`,
        pluginId: id,
      })
    }
  }

  for (const id of disabledContributions) {
    if (!seenFullIds.has(id)) {
      diagnostics.push({
        code: "unknown-disable-target",
        message: `disable.contributions names "${id}", which no contribution in the list carries.`,
      })
    }
  }

  // Later patches to one target replace earlier ones wholly — a Map keyed by
  // target is exactly that rule.
  const patches = new Map(
    (options?.overrides ?? []).map((override) => [override.target, override]),
  )

  for (const [target, patch] of patches) {
    if (!seenFullIds.has(target)) {
      diagnostics.push({
        code: "unknown-override-target",
        message: `An override targets "${target}", which no contribution in the list carries.`,
        slot: patch.slot,
      })

      continue
    }

    // A target that exists but is disabled is a silent no-op: the override
    // still addresses something real, the integrator just turned it off.
    const entry = ranked.get(target)

    if (!entry) {
      continue
    }

    if (patch.slot !== entry.slot) {
      diagnostics.push({
        code: "override-slot-mismatch",
        message: `An override for slot "${patch.slot}" targets "${target}", which contributes to slot "${entry.slot}". The patch is ignored.`,
        pluginId: entry.pluginId,
        contributionId: entry.contributionId,
        slot: entry.slot,
      })

      continue
    }

    if (patch.order !== undefined) {
      entry.order = patch.order
    }

    if (patch.component !== undefined) {
      entry.component = patch.component
    }
  }

  // Grouped through a Map, delivered on a prototype-less record: slot names
  // are arbitrary strings, and "__proto__" or "constructor" must be ordinary
  // keys — unreadable by accident, unwritable into the prototype chain.
  const groups = new Map<string, Ranked[]>()

  for (const entry of ranked.values()) {
    const group = groups.get(entry.slot) ?? []

    group.push(entry)
    groups.set(entry.slot, group)
  }

  const slots: Record<string, readonly ResolvedEntry[]> = Object.create(null)

  for (const [slot, group] of groups) {
    group.sort(
      (a, b) =>
        a.order - b.order ||
        a.pluginIndex - b.pluginIndex ||
        a.declaredIndex - b.declaredIndex,
    )

    slots[slot] = group.map((entry, seq) => ({
      key: entry.key,
      pluginId: entry.pluginId,
      contributionId: entry.contributionId,
      slot: entry.slot,
      order: entry.order,
      seq,
      component: entry.component,
    }))
  }

  return { slots, diagnostics }
}

/**
 * The entries of one slot, typed by its descriptor.
 *
 * Restores what `contribute` erased — the slot's own types guaranteed the
 * match at registration, which is what pays for the cast. Reads own
 * properties only: `Resolution.slots` has no prototype, but a hand-built one
 * might, and a slot named "constructor" must never read inherited values.
 */
export function entriesOf<Props extends object>(
  resolution: Resolution,
  slot: Slot<Props>,
): readonly ResolvedEntry<Props>[] {
  const entries = Object.hasOwn(resolution.slots, slot.name)
    ? resolution.slots[slot.name]
    : undefined

  return (entries ?? NO_ENTRIES) as unknown as readonly ResolvedEntry<Props>[]
}
