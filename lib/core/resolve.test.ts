// @vitest-environment node
import type { ComponentType } from "react"
import { describe, expect, expectTypeOf, it } from "vitest"

import {
  assertNoDiagnostics,
  type Contribution,
  definePlugin,
  defineSlot,
  entriesOf,
  filterResolution,
  type Override,
  resolvePlugins,
} from "./index"

type NavProps = { current: string }

const Nav = defineSlot<NavProps>("crm.nav")
const Toolbar = defineSlot("crm.toolbar")

const NavLink: ComponentType<NavProps> = () => null
const OtherNavLink: ComponentType<NavProps> = () => null
const ToolbarButton: ComponentType<Record<never, never>> = () => null

function codes(resolution: { diagnostics: readonly { code: string }[] }) {
  return resolution.diagnostics.map((diagnostic) => diagnostic.code)
}

describe("defineSlot / definePlugin", () => {
  it("throws on an empty slot name", () => {
    expect(() => defineSlot("")).toThrow(/non-empty name/)
  })

  it("throws on an empty plugin id", () => {
    expect(() => definePlugin({ id: "" })).toThrow(/non-empty id/)
  })

  it("keeps the caller's own plugin fields and their types", () => {
    const plugin = definePlugin({ id: "pricing", title: "Pricing" })

    expectTypeOf(plugin.title).toEqualTypeOf<string>()
    expect(plugin.title).toBe("Pricing")
  })
})

describe("resolvePlugins", () => {
  const pricing = definePlugin({
    id: "pricing",
    contributes: [
      Nav.contribute("nav-link", { order: 10, component: NavLink }),
      Toolbar.contribute("button", { component: ToolbarButton }),
    ],
  })

  const billing = definePlugin({
    id: "billing",
    contributes: [Nav.contribute("nav-link", { order: 5, component: NavLink })],
  })

  it("is deterministic: same inputs, deep-equal output", () => {
    const options = {
      disable: { contributions: ["pricing/button"] },
      overrides: [Nav.override("billing/nav-link", { order: 99 })],
    }

    expect(resolvePlugins([pricing, billing], options)).toEqual(
      resolvePlugins([pricing, billing], options),
    )
  })

  it("does not mutate its inputs", () => {
    const frozen = [pricing, billing].map((plugin) =>
      Object.freeze({
        ...plugin,
        contributes: Object.freeze(
          (plugin.contributes ?? []).map((contribution) =>
            Object.freeze({ ...contribution }),
          ),
        ),
      }),
    )

    expect(() =>
      resolvePlugins(Object.freeze(frozen), {
        overrides: [Nav.override("pricing/nav-link", { order: 1 })],
      }),
    ).not.toThrow()
  })

  it("sorts by order, plugin and declaration position, then stamps seq", () => {
    const first = definePlugin({
      id: "first",
      contributes: [
        Nav.contribute("b", { order: 0, component: NavLink }),
        Nav.contribute("a", { order: 0, component: NavLink }),
      ],
    })

    const second = definePlugin({
      id: "second",
      contributes: [
        Nav.contribute("early", { order: -1, component: NavLink }),
        Nav.contribute("tie", { order: 0, component: NavLink }),
      ],
    })

    const entries = entriesOf(resolvePlugins([first, second]), Nav)

    expect(entries.map((entry) => [entry.key, entry.seq])).toEqual([
      ["second/early", 0],
      ["first/b", 1],
      ["first/a", 2],
      ["second/tie", 3],
    ])
  })

  it("resolves an empty plugin list to an empty graph", () => {
    const resolution = resolvePlugins([])

    expect(resolution.diagnostics).toEqual([])
    expect(Object.keys(resolution.slots)).toEqual([])
  })

  it("tolerates a plugin without contributions", () => {
    expect(codes(resolvePlugins([definePlugin({ id: "bare" })]))).toEqual([])
  })
})

describe("diagnostics", () => {
  it("reports a duplicate plugin id and drops the second copy's entries", () => {
    const plugin = definePlugin({
      id: "pricing",
      contributes: [Nav.contribute("nav-link", { component: NavLink })],
    })

    const resolution = resolvePlugins([plugin, plugin])

    expect(codes(resolution)).toEqual([
      "duplicate-plugin-id",
      "duplicate-contribution-id",
    ])
    expect(entriesOf(resolution, Nav)).toHaveLength(1)
  })

  it("drops the later of two contributions sharing a full id", () => {
    const plugin = definePlugin({
      id: "pricing",
      contributes: [
        Nav.contribute("link", { component: NavLink }),
        Nav.contribute("link", { component: OtherNavLink }),
      ],
    })

    const resolution = resolvePlugins([plugin])

    expect(codes(resolution)).toEqual(["duplicate-contribution-id"])
    expect(entriesOf(resolution, Nav)[0]?.component).toBe(NavLink)
  })

  it("rejects empty ids and ids containing a slash", () => {
    const plugin = definePlugin({
      id: "pricing",
      contributes: [
        Nav.contribute("", { component: NavLink }),
        Nav.contribute("a/b", { component: NavLink }),
      ],
    })

    const resolution = resolvePlugins([plugin])

    expect(codes(resolution)).toEqual([
      "invalid-contribution-id",
      "invalid-contribution-id",
    ])
    expect(entriesOf(resolution, Nav)).toHaveLength(0)
  })

  it("reports disable targets that address nothing", () => {
    const resolution = resolvePlugins([definePlugin({ id: "pricing" })], {
      disable: { plugins: ["ghost"], contributions: ["ghost/entry"] },
    })

    expect(codes(resolution)).toEqual([
      "unknown-disable-target",
      "unknown-disable-target",
    ])
  })

  it("reports manifest defects even inside a disabled plugin", () => {
    const broken = definePlugin({
      id: "broken",
      contributes: [Nav.contribute("a/b", { component: NavLink })],
    })

    const resolution = resolvePlugins([broken], {
      disable: { plugins: ["broken"] },
    })

    expect(codes(resolution)).toEqual(["invalid-contribution-id"])
  })

  it("reports an override that addresses nothing", () => {
    const resolution = resolvePlugins([], {
      overrides: [Nav.override("ghost/entry", { order: 1 })],
    })

    expect(codes(resolution)).toEqual(["unknown-override-target"])
  })

  it("ignores an override whose slot does not match its target", () => {
    const plugin = definePlugin({
      id: "pricing",
      contributes: [Nav.contribute("nav-link", { component: NavLink })],
    })

    const resolution = resolvePlugins([plugin], {
      overrides: [Toolbar.override("pricing/nav-link", { order: 99 })],
    })

    expect(codes(resolution)).toEqual(["override-slot-mismatch"])
    expect(entriesOf(resolution, Nav)[0]?.order).toBe(0)
  })
})

describe("disable", () => {
  const pricing = definePlugin({
    id: "pricing",
    contributes: [
      Nav.contribute("nav-link", { component: NavLink }),
      Toolbar.contribute("button", { component: ToolbarButton }),
    ],
  })

  it("drops a whole plugin silently", () => {
    const resolution = resolvePlugins([pricing], {
      disable: { plugins: ["pricing"] },
    })

    expect(resolution.diagnostics).toEqual([])
    expect(entriesOf(resolution, Nav)).toHaveLength(0)
    expect(entriesOf(resolution, Toolbar)).toHaveLength(0)
  })

  it("drops one contribution and keeps its siblings", () => {
    const resolution = resolvePlugins([pricing], {
      disable: { contributions: ["pricing/nav-link"] },
    })

    expect(resolution.diagnostics).toEqual([])
    expect(entriesOf(resolution, Nav)).toHaveLength(0)
    expect(entriesOf(resolution, Toolbar)).toHaveLength(1)
  })

  it("lets an override of a disabled target no-op without noise", () => {
    const resolution = resolvePlugins([pricing], {
      disable: { contributions: ["pricing/nav-link"] },
      overrides: [Nav.override("pricing/nav-link", { order: 99 })],
    })

    expect(resolution.diagnostics).toEqual([])
  })
})

describe("overrides", () => {
  const pricing = definePlugin({
    id: "pricing",
    contributes: [
      Nav.contribute("nav-link", { order: 10, component: NavLink }),
    ],
  })

  it("replaces order and re-ranks the entry", () => {
    const other = definePlugin({
      id: "other",
      contributes: [Nav.contribute("link", { order: 5, component: NavLink })],
    })

    const resolution = resolvePlugins([pricing, other], {
      overrides: [Nav.override("pricing/nav-link", { order: 1 })],
    })

    expect(entriesOf(resolution, Nav).map((entry) => entry.key)).toEqual([
      "pricing/nav-link",
      "other/link",
    ])
  })

  it("replaces the component", () => {
    const resolution = resolvePlugins([pricing], {
      overrides: [
        Nav.override("pricing/nav-link", { component: OtherNavLink }),
      ],
    })

    expect(entriesOf(resolution, Nav)[0]?.component).toBe(OtherNavLink)
  })

  it("lets the last patch to one target win wholly", () => {
    const resolution = resolvePlugins([pricing], {
      overrides: [
        Nav.override("pricing/nav-link", { component: OtherNavLink }),
        Nav.override("pricing/nav-link", { order: 1 }),
      ],
    })

    const entry = entriesOf(resolution, Nav)[0]

    expect(entry?.order).toBe(1)
    expect(entry?.component).toBe(NavLink)
  })
})

describe("prototype-key slot names", () => {
  it.each(["__proto__", "constructor", "hasOwnProperty"])(
    "treats %s as an ordinary slot name",
    (name) => {
      const Reserved = defineSlot(name)
      const plugin = definePlugin({
        id: "p",
        contributes: [
          Reserved.contribute("entry", { component: ToolbarButton }),
        ],
      })

      const resolution = resolvePlugins([plugin])

      expect(entriesOf(resolution, Reserved)).toHaveLength(1)
      expect(entriesOf(resolvePlugins([]), Reserved)).toEqual([])
    },
  )

  it("never exposes inherited values through naive reads", () => {
    const slots = resolvePlugins([]).slots as Record<string, unknown>

    expect(slots.constructor).toBeUndefined()
    expect(slots.hasOwnProperty).toBeUndefined()
  })
})

describe("entriesOf typing", () => {
  it("restores the slot's props type on the component", () => {
    const plugin = definePlugin({
      id: "pricing",
      contributes: [Nav.contribute("nav-link", { component: NavLink })],
    })

    const [entry] = entriesOf(resolvePlugins([plugin]), Nav)

    if (!entry) {
      throw new Error("expected one entry")
    }

    // The Codex P1 falsifier: a strict server host renders this component
    // with the slot's props and no cast.
    expectTypeOf(entry.component).toEqualTypeOf<ComponentType<NavProps>>()
    expect(entry.component).toBe(NavLink)
  })
})

describe("non-finite orders", () => {
  it("keeps every contribution when an order is not a finite number", () => {
    const Menu = defineSlot("core.non-finite")

    const plugin = definePlugin({
      id: "edges",
      contributes: [
        Menu.contribute("last-a", {
          order: Number.POSITIVE_INFINITY,
          component: ToolbarButton,
        }),
        Menu.contribute("middle", { order: 0, component: ToolbarButton }),
        Menu.contribute("last-b", {
          order: Number.POSITIVE_INFINITY,
          component: ToolbarButton,
        }),
        Menu.contribute("first", {
          order: Number.NEGATIVE_INFINITY,
          component: ToolbarButton,
        }),
      ],
    })

    const entries = entriesOf(resolvePlugins([plugin]), Menu)

    expect(entries).toHaveLength(4)
    expect(entries[0]?.contributionId).toBe("first")
    expect(entries[1]?.contributionId).toBe("middle")
    expect(entries.slice(2).map((entry) => entry.contributionId)).toEqual(
      expect.arrayContaining(["last-a", "last-b"]),
    )
  })
})

describe("severity", () => {
  it("separates a dropped contribution from a stale option", () => {
    const twice = definePlugin({
      id: "pricing",
      contributes: [
        Nav.contribute("nav-link", { component: NavLink }),
        Nav.contribute("nav-link", { component: OtherNavLink }),
      ],
    })

    const resolution = resolvePlugins([twice], {
      disable: { plugins: ["ghost"] },
    })

    const bySeverity = Object.fromEntries(
      resolution.diagnostics.map((d) => [d.code, d.severity]),
    )

    // The graph is not what the manifest declared: one entry is gone.
    expect(bySeverity["duplicate-contribution-id"]).toBe("error")
    // The graph is exactly as declared; the option names nothing.
    expect(bySeverity["unknown-disable-target"]).toBe("warning")
  })
})

describe("assertNoDiagnostics", () => {
  it("passes a clean graph", () => {
    const pricing = definePlugin({
      id: "pricing",
      contributes: [Nav.contribute("nav-link", { component: NavLink })],
    })

    expect(() => assertNoDiagnostics(resolvePlugins([pricing]))).not.toThrow()
  })

  it("throws on a dropped contribution, naming every one", () => {
    const twice = definePlugin({
      id: "pricing",
      contributes: [
        Nav.contribute("nav-link", { component: NavLink }),
        Nav.contribute("nav-link", { component: OtherNavLink }),
        Toolbar.contribute("bad/id", { component: ToolbarButton }),
      ],
    })

    expect(() => assertNoDiagnostics(resolvePlugins([twice]))).toThrow(
      /2 manifest defect\(s\)/,
    )

    expect(() => assertNoDiagnostics(resolvePlugins([twice]))).toThrow(
      /duplicate-contribution-id/,
    )
  })

  it("lets a stale option through: the graph is still as declared", () => {
    const resolution = resolvePlugins([], {
      disable: { plugins: ["ghost"] },
    })

    expect(resolution.diagnostics).toHaveLength(1)
    expect(() => assertNoDiagnostics(resolution)).not.toThrow()
  })
})

describe("filterResolution", () => {
  const pricing = definePlugin({
    id: "pricing",
    contributes: [
      Nav.contribute("first", { order: 1, component: NavLink }),
      Nav.contribute("second", { order: 2, component: OtherNavLink }),
      Nav.contribute("third", { order: 3, component: NavLink }),
      Toolbar.contribute("button", { component: ToolbarButton }),
    ],
  })

  const resolved = resolvePlugins([pricing])

  it("closes the holes a plain filter would leave in seq", () => {
    const filtered = filterResolution(
      resolved,
      (entry) => entry.contributionId !== "second",
    )

    const entries = entriesOf(filtered, Nav)

    expect(entries.map((entry) => entry.contributionId)).toEqual([
      "first",
      "third",
    ])
    // The whole point: `seq` is the position, so it must be 0,1 — not 0,2.
    expect(entries.map((entry) => entry.seq)).toEqual([0, 1])
    // `order` is a declared priority, not a position, so it is untouched.
    expect(entries.map((entry) => entry.order)).toEqual([1, 3])
  })

  it("drops a slot left with nothing instead of keeping it empty", () => {
    const filtered = filterResolution(
      resolved,
      (entry) => entry.slot !== Toolbar.name,
    )

    expect(Object.hasOwn(filtered.slots, Toolbar.name)).toBe(false)
    expect(entriesOf(filtered, Toolbar)).toEqual([])
  })

  it("keeps the record prototype-less", () => {
    const evil = defineSlot("__proto__")

    const plugin = definePlugin({
      id: "evil",
      contributes: [evil.contribute("entry", { component: ToolbarButton })],
    })

    const filtered = filterResolution(resolvePlugins([plugin]), () => true)

    expect(Object.getPrototypeOf(filtered.slots)).toBe(null)
    expect(entriesOf(filtered, evil)).toHaveLength(1)
    expect({}.toString).toBeTypeOf("function")
  })

  it("carries diagnostics through and leaves the source alone", () => {
    const source = resolvePlugins([pricing], {
      disable: { plugins: ["ghost"] },
    })

    const before = structuredCloneable(source)
    const filtered = filterResolution(source, () => false)

    expect(filtered.diagnostics).toBe(source.diagnostics)
    expect(structuredCloneable(source)).toEqual(before)
    expect(Object.keys(filtered.slots)).toEqual([])
  })

  it("composes, because the output is an ordinary Resolution", () => {
    const once = filterResolution(resolved, (entry) => entry.order !== 2)
    const twice = filterResolution(once, (entry) => entry.order !== 3)

    expect(entriesOf(twice, Nav).map((entry) => entry.seq)).toEqual([0])
  })
})

/** The metadata half of a Resolution, which is what must not move. */
function structuredCloneable(resolution: {
  slots: Readonly<Record<string, readonly { key: string; seq: number }[]>>
}) {
  return Object.entries(resolution.slots).map(([slot, entries]) => [
    slot,
    entries.map((entry) => `${entry.key}#${entry.seq}`),
  ])
}

describe("minting", () => {
  it("refuses a contribution that no descriptor produced", () => {
    const forged = {
      slot: Nav.name,
      id: "forged",
      order: 0,
      // A component typed for another slot entirely — which is exactly what
      // `contribute` exists to rule out, and what `ErasedComponent` cannot:
      // it accepts every component by contravariance.
      component: ToolbarButton,
    }

    // @ts-expect-error — only `slot.contribute()` mints a Contribution.
    const smuggled: Contribution = forged

    // The brand is a phantom: at runtime there is nothing to see.
    expect(smuggled).toBe(forged)
  })

  it("refuses an override that no descriptor produced", () => {
    const forged = { slot: Nav.name, target: "pricing/nav-link", order: 1 }

    // @ts-expect-error — only `slot.override()` mints an Override.
    const smuggled: Override = forged

    expect(smuggled).toBe(forged)
  })

  it("refuses a component the slot does not hand props to", () => {
    const Counter: ComponentType<{ count: number }> = () => null

    // @ts-expect-error — Nav hands out NavProps, which carries no `count`.
    Nav.contribute("counter", { component: Counter })

    // A component that ignores props serves any slot, which is correct.
    expect(Nav.contribute("any", { component: ToolbarButton })).toBeTruthy()
  })
})
