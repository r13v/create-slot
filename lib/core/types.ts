import type { ComponentType } from "react"

/**
 * A contribution component with its props erased, so one graph can hold the
 * contributions of every slot. A host — or `entriesOf` — restores the slot's
 * props type on the way out.
 */
export type ErasedComponent = ComponentType<never>

/**
 * One contribution, produced by `slot.contribute()`.
 *
 * Data, not an element: a host renders it, so the whole list is known
 * synchronously — on the server too.
 */
export type Contribution = {
  slot: string
  /**
   * Local id: unique within its plugin, never contains "/". The full address
   * is `${plugin.id}/${id}` — the React key, the override target, and the
   * name diagnostics call it by.
   */
  id: string
  /** Priority, not an array index. Equal values are a stable tie. */
  order: number
  component: ErasedComponent
}

/**
 * Everything the library needs to know about a plugin, and nothing else.
 *
 * Names, descriptions, capability keys, routes, lifecycle — none of that is
 * read here, so none of it belongs here. Declare those on your own plugin
 * type; `definePlugin` is generic over its argument, so they keep their types.
 */
export type PluginDefinition = {
  /** Unique across the app; namespaces every contribution id and React key. */
  id: string
  contributes?: readonly Contribution[]
}

/** What a contribution declares besides its identity. */
export type ContributionSpec<Props extends object> = {
  /** Priority. Ties break by plugin position in the list, then declaration. */
  order?: number
  /** Receives the host's props. Decides its own visibility with plain `if`. */
  component: ComponentType<Props>
}

/**
 * A patch aimed at one full contribution id, created only via
 * `slot.override()` — which is where its `component` was still typed. Opaque
 * data afterwards; `resolvePlugins` consumes it.
 */
export type Override = {
  readonly slot: string
  /** The full contribution id (`pluginId/contributionId`) this patch targets. */
  readonly target: string
  readonly order?: number
  readonly component?: ErasedComponent
}

/**
 * A slot: a name plus a props type — data, never a component.
 *
 * Type safety lives on this object, because a string id cannot carry `Props`.
 * Property-style members, not methods: methods are bivariant in their
 * parameters, and a mismatched descriptor must not pass silently.
 */
export type Slot<Props extends object> = {
  readonly name: string
  /** Declares a contribution as manifest data — what a server render sees. */
  readonly contribute: (
    id: string,
    spec: ContributionSpec<Props>,
  ) => Contribution
  /** A typed patch aimed at one full contribution id. */
  readonly override: (
    target: string,
    patch: { order?: number; component?: ComponentType<Props> },
  ) => Override
}

/** The single options bag. Pure data in; a new bag means a new Resolution. */
export type ResolveOptions = {
  disable?: {
    /** Plugin ids to drop whole. */
    plugins?: readonly string[]
    /** Full contribution ids (`pluginId/contributionId`) to drop one by one. */
    contributions?: readonly string[]
  }
  /** Typed patches from `slot.override()`. Later patches to one target win. */
  overrides?: readonly Override[]
}

/**
 * One contribution as a host renders it: identified, ranked, erased.
 *
 * The generic restores the component's props type for typed lookups
 * (`entriesOf`); without an argument it is the erased form the entries take
 * inside `Resolution.slots`. `ComponentType` is contravariant in its props,
 * so the erased form is a correct supertype of every typed one.
 */
export type ResolvedEntry<Props extends object = never> = {
  /** `${pluginId}/${contributionId}` — also the React key every host uses. */
  key: string
  pluginId: string
  contributionId: string
  slot: string
  order: number
  /** Position after sorting: order, then plugin position, then declaration. */
  seq: number
  component: ComponentType<Props>
}

/** A problem the resolver found. Returned, never thrown. */
export type Diagnostic = {
  code:
    | "duplicate-plugin-id"
    | "duplicate-contribution-id"
    | "invalid-contribution-id"
    | "unknown-disable-target"
    | "unknown-override-target"
    | "override-slot-mismatch"
  message: string
  pluginId?: string
  contributionId?: string
  slot?: string
}

/**
 * The resolved graph: plain data whose components are references.
 *
 * The metadata is JSON-compatible; `component` is a function (or an RSC
 * client reference), so the object as a whole crosses an RSC boundary under
 * the two-module discipline but never survives a JSON round-trip.
 *
 * `slots` is built without a prototype, so a slot named "constructor" or
 * "__proto__" is an ordinary key: naive reads cannot reach inherited values.
 * Read it with `Object.hasOwn` all the same — `entriesOf` does.
 */
export type Resolution = {
  /** Slot name → sorted contributions. A missing key means none contributed. */
  readonly slots: Readonly<Record<string, readonly ResolvedEntry[]>>
  readonly diagnostics: readonly Diagnostic[]
}
