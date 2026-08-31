// @vitest-environment node
import type { ComponentType } from "react"
import { describe, expect, expectTypeOf, it } from "vitest"

import { definePlugin, defineSlot, entriesOf, resolvePlugins } from "./index"

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

  it("sorts by order, then plugin position, then declaration position", () => {
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

    const keys = entriesOf(resolvePlugins([first, second]), Nav).map(
      (entry) => entry.key,
    )

    expect(keys).toEqual(["second/early", "first/b", "first/a", "second/tie"])
  })

  it("stamps seq as the position after sorting", () => {
    const entries = entriesOf(resolvePlugins([pricing, billing]), Nav)

    expect(entries.map((entry) => entry.seq)).toEqual([0, 1])
    expect(entries[0]?.key).toBe("billing/nav-link")
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
