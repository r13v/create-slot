import { buildSlot } from "./slot"

// The declarative half of the library: a contribution is manifest data, which
// is what a server render can enumerate. See REGISTRY.md.
export {
  type Contribution,
  definePlugin,
  type ErasedComponent,
  type PluginDefinition,
} from "./plugin"
export {
  type PluginError,
  PluginProvider,
  type PluginProviderProps,
  type RenderFailed,
  usePluginId,
} from "./provider"
export { type ContributionSpec, defineSlot, type SlotDefinition } from "./slot"

export type Slot<Props> = React.FC<{
  children: React.ReactElement
  /** Priority. Read once, when the fill mounts. */
  order?: number
}> & {
  Host: React.FC<React.PropsWithChildren<Props>>
  useProps(): Props
}

/**
 * Slots created here are anonymous, so each factory needs a name of its own:
 * the registry keys contributions by slot name, and two factories must stay as
 * isolated as they have always been.
 */
let nextSlotId = 0

/**
 * Factory function that creates a Slot component.
 *
 * A thin façade over the registry's runtime channel: `Slot` is a `Fill`;
 * `Host` and `useProps` are the registry's own, with the host's children as
 * the placeholder. Everything about how contributions are stored, ordered and
 * delivered lives in the registry.
 *
 * The same registry offers a second, declarative channel — `defineSlot`,
 * `definePlugin` and `PluginProvider` — which a server render can see. This one
 * cannot: its server and hydration snapshots stay empty because the first client
 * render cannot reproduce fills that later subtrees have not registered yet.
 *
 * These names are the ones 2.x published, so they stay as they are, in the
 * older wording: here a `Slot` is the thing that contributes. The canonical
 * vocabulary is in CONTEXT.md, and why both survive is in
 * docs/adr/0001-two-vocabularies.md.
 */
export function createSlot<Props>(): Slot<Props> {
  const slot = buildSlot<Props & object>(`create-slot:${nextSlotId++}`, false)

  const SlotComponent: Slot<Props> = ({ order, children }) => {
    if (!children) {
      throw new Error("[create-slot] 'Slot' without children rendered")
    }

    return <slot.Fill order={order}>{children}</slot.Fill>
  }

  // Both casts pay for the published signature. `createSlot<Props>()` has never
  // constrained `Props`, so the registry is widened with `& object` and narrowed
  // back here. And `useProps` is nullable in the registry, honestly — a host is
  // not guaranteed above you — while a `Slot`'s children only ever render
  // inside one, which is why the façade can promise `Props`.
  SlotComponent.Host = slot.Host as Slot<Props>["Host"]
  SlotComponent.useProps = slot.useProps as () => Props

  return SlotComponent
}
