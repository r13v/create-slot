import { restoreEntries } from "./erasure"
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

/** A sorted entry before `seq` — its position — has been stamped on. */
type Unranked = Omit<ResolvedEntry, "seq">

/**
 * Lays sorted entries onto a prototype-less record, stamping `seq` as it
 * goes. Slot names are arbitrary strings, and "__proto__" or "constructor"
 * must be ordinary keys — unreadable by accident, unwritable into the
 * prototype chain. Every `Resolution` in the library is built here, which is
 * what keeps a derived one indistinguishable from a resolved one.
 */
function recordOf(
  groups: Iterable<[string, readonly Unranked[]]>,
): Record<string, readonly ResolvedEntry[]> {
  const slots: Record<string, readonly ResolvedEntry[]> = Object.create(null)

  for (const [slot, entries] of groups) {
    slots[slot] = entries.map((entry, seq) => ({ ...entry, seq }))
  }

  return slots
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
        severity: "error",
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
          severity: "error",
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
          severity: "error",
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
        severity: "warning",
        message: `disable.plugins names "${id}", which no plugin in the list carries.`,
        pluginId: id,
      })
    }
  }

  for (const id of disabledContributions) {
    if (!seenFullIds.has(id)) {
      diagnostics.push({
        code: "unknown-disable-target",
        severity: "warning",
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
        severity: "warning",
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
        severity: "error",
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

  const groups = new Map<string, Ranked[]>()

  for (const entry of ranked.values()) {
    const group = groups.get(entry.slot) ?? []

    group.push(entry)
    groups.set(entry.slot, group)
  }

  const sorted = new Map<string, readonly Unranked[]>()

  for (const [slot, group] of groups) {
    group.sort(
      (a, b) =>
        a.order - b.order ||
        a.pluginIndex - b.pluginIndex ||
        a.declaredIndex - b.declaredIndex,
    )

    // Drops the input positions the sort needed; `recordOf` stamps `seq`.
    sorted.set(
      slot,
      group.map((entry) => ({
        key: entry.key,
        pluginId: entry.pluginId,
        contributionId: entry.contributionId,
        slot: entry.slot,
        order: entry.order,
        component: entry.component,
      })),
    )
  }

  return { slots: recordOf(sorted), diagnostics }
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

  return restoreEntries<Props>(entries ?? NO_ENTRIES)
}

/**
 * A derived Resolution keeping only the entries `keep` accepts.
 *
 * This is the supported way to write the policies the library deliberately
 * does not have — limits, allowlists, "one owner per slot". A plain `.filter`
 * over `Resolution.slots` would lose two invariants that are not visible in
 * the type: the record has no prototype, and `seq` is the position *after*
 * sorting, so filtering leaves holes in it. Both are restored here.
 *
 * Diagnostics pass through untouched: they describe the manifests, not the
 * view an application chose to take of them. A slot left with no entries is
 * dropped from the record, which is how `entriesOf` already reads "none".
 */
export function filterResolution(
  resolution: Resolution,
  keep: (entry: ResolvedEntry) => boolean,
): Resolution {
  const kept: [string, readonly Unranked[]][] = []

  for (const slot of Object.keys(resolution.slots)) {
    const entries = resolution.slots[slot]?.filter(keep) ?? NO_ENTRIES

    if (entries.length > 0) {
      kept.push([slot, entries])
    }
  }

  return { slots: recordOf(kept), diagnostics: resolution.diagnostics }
}

/**
 * Throws if the graph is not what the manifests declared.
 *
 * The resolver reports and carries on, because one plugin's typo must not
 * take an application down at runtime. A build is the opposite setting: this
 * is the one line that turns the same diagnostics into a failing test.
 *
 * Only `severity: "error"` throws — something was dropped or a patch refused.
 * A warning means a `disable` or `override` option names a target that does
 * not exist, which leaves the graph exactly as declared; read
 * `resolution.diagnostics` directly for a check that is stricter than this.
 */
export function assertNoDiagnostics(resolution: Resolution): void {
  const errors = resolution.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  )

  if (errors.length === 0) {
    return
  }

  const lines = errors.map(
    (diagnostic) => `  ${diagnostic.code}: ${diagnostic.message}`,
  )

  throw new Error(
    `[create-slot] ${errors.length} manifest defect(s):\n${lines.join("\n")}`,
  )
}
