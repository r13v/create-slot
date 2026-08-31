import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  collectRecoveries,
  stopCollectingRecoveries,
} from "../../test/recoveries"
import { definePlugin, defineSlot, resolvePlugins } from "../core"
import { propsContextOf, useContribution, useSlotProps } from "./hooks"
import type { HostEntry } from "./host"
import { SlotHost } from "./host"
import type { SlotError } from "./provider"
import { SlotProvider } from "./provider"

function items(): string[] {
  return Array.from(document.querySelectorAll("li")).map(
    (li) => li.textContent?.trim() ?? "",
  )
}

function silenceConsole() {
  vi.spyOn(console, "error").mockImplementation(() => {})
}

afterEach(() => {
  stopCollectingRecoveries()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("host rendering", () => {
  it("renders contributions in resolved order", () => {
    const NavMenu = defineSlot("adapter.ordering")

    const first = definePlugin({
      id: "first",
      contributes: [
        NavMenu.contribute("ranked", {
          order: 20,
          component: () => <li>first 20</li>,
        }),
        NavMenu.contribute("tie-a", { component: () => <li>first tie a</li> }),
        NavMenu.contribute("tie-b", { component: () => <li>first tie b</li> }),
      ],
    })

    const second = definePlugin({
      id: "second",
      contributes: [
        NavMenu.contribute("ranked", {
          order: 10,
          component: () => <li>second 10</li>,
        }),
        NavMenu.contribute("tie", { component: () => <li>second tie</li> }),
      ],
    })

    render(
      <SlotProvider resolution={resolvePlugins([first, second])}>
        <ul>
          <SlotHost slot={NavMenu} />
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual([
      "first tie a",
      "first tie b",
      "second tie",
      "second 10",
      "first 20",
    ])
  })

  it("renders the placeholder only while nothing is contributed", () => {
    const Empty = defineSlot("adapter.placeholder")
    const Filled = defineSlot("adapter.placeholder-filled")

    const plugin = definePlugin({
      id: "p",
      contributes: [
        Filled.contribute("entry", { component: () => <li>entry</li> }),
      ],
    })

    render(
      <SlotProvider resolution={resolvePlugins([plugin])}>
        <ul data-testid="empty">
          <SlotHost slot={Empty}>
            <li>placeholder</li>
          </SlotHost>
        </ul>
        <ul data-testid="filled">
          <SlotHost slot={Filled}>
            <li>placeholder</li>
          </SlotHost>
        </ul>
      </SlotProvider>,
    )

    expect(screen.getByTestId("empty").textContent).toBe("placeholder")
    expect(screen.getByTestId("filled").textContent).toBe("entry")
  })

  it("renders nothing for an empty slot without a placeholder", () => {
    const Empty = defineSlot("adapter.empty")

    render(
      <SlotProvider resolution={resolvePlugins([])}>
        <ul>
          <SlotHost slot={Empty} />
        </ul>
      </SlotProvider>,
    )

    expect(document.querySelector("ul")?.innerHTML).toBe("")
  })

  it("serves several hosts of one slot at once", () => {
    const Menu = defineSlot("adapter.two-hosts")

    const plugin = definePlugin({
      id: "p",
      contributes: [Menu.contribute("entry", { component: () => <li>x</li> })],
    })

    render(
      <SlotProvider resolution={resolvePlugins([plugin])}>
        <ul>
          <SlotHost slot={Menu} />
        </ul>
        <ul>
          <SlotHost slot={Menu} />
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual(["x", "x"])
  })

  it("throws when a host renders outside the provider", () => {
    silenceConsole()

    const Orphan = defineSlot("adapter.orphan")

    expect(() => render(<SlotHost slot={Orphan} />)).toThrow(
      "[create-slot] 'SlotHost' rendered outside of 'SlotProvider'",
    )
  })

  it("renders once under StrictMode", () => {
    const Menu = defineSlot("adapter.strict")

    const plugin = definePlugin({
      id: "p",
      contributes: [
        Menu.contribute("entry", { component: () => <li>strict</li> }),
      ],
    })

    render(
      <React.StrictMode>
        <SlotProvider resolution={resolvePlugins([plugin])}>
          <ul>
            <SlotHost slot={Menu} />
          </ul>
        </SlotProvider>
      </React.StrictMode>,
    )

    expect(items()).toEqual(["strict"])
  })
})

describe("provider", () => {
  it("lets a nested provider shadow the outer one", () => {
    const Menu = defineSlot("adapter.nested")

    const outer = definePlugin({
      id: "outer",
      contributes: [
        Menu.contribute("entry", { component: () => <li>outer</li> }),
      ],
    })

    const inner = definePlugin({
      id: "inner",
      contributes: [
        Menu.contribute("entry", { component: () => <li>inner</li> }),
      ],
    })

    render(
      <SlotProvider resolution={resolvePlugins([outer])}>
        <ul data-testid="outer">
          <SlotHost slot={Menu} />
        </ul>
        <SlotProvider resolution={resolvePlugins([inner])}>
          <ul data-testid="inner">
            <SlotHost slot={Menu} />
          </ul>
        </SlotProvider>
      </SlotProvider>,
    )

    // Nesting replaces the resolution for the subtree; it does not add to it.
    expect(screen.getByTestId("outer").textContent).toBe("outer")
    expect(screen.getByTestId("inner").textContent).toBe("inner")
  })

  it("neither remounts nor re-renders contributions when the graph is re-resolved inline", () => {
    const Menu = defineSlot("adapter.inline-resolution")
    let mounts = 0
    let renders = 0

    function Item() {
      renders++

      React.useEffect(() => {
        mounts++
      }, [])

      return <li>item</li>
    }

    const plugin = definePlugin({
      id: "stable",
      contributes: [Menu.contribute("entry", { component: Item })],
    })

    function App({ tick }: { tick: number }) {
      // A fresh Resolution every render: entry content is equal, identity is
      // not — exactly what the content comparator exists for.
      return (
        <SlotProvider resolution={resolvePlugins([plugin])}>
          <p>{tick}</p>
          <ul>
            <SlotHost slot={Menu} />
          </ul>
        </SlotProvider>
      )
    }

    const { rerender } = render(<App tick={1} />)

    rerender(<App tick={2} />)
    rerender(<App tick={3} />)

    expect(items()).toEqual(["item"])
    expect(mounts).toBe(1)
    expect(renders).toBe(1)
  })

  it("reports diagnostics once, deduped by content", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})

    const resolve = () =>
      resolvePlugins([], { disable: { plugins: ["ghost"] } })

    function App({ tick }: { tick: number }) {
      return (
        <SlotProvider resolution={resolve()}>
          <p>{tick}</p>
        </SlotProvider>
      )
    }

    const { rerender } = render(<App tick={1} />)

    rerender(<App tick={2} />)

    const reported = errors.mock.calls.filter((call) =>
      String(call[0]).includes("[create-slot]"),
    )

    expect(reported).toHaveLength(1)
    expect(String(reported[0]?.[0])).toContain('"ghost"')
  })
})

describe("failure isolation", () => {
  it("contains a failing contribution and reports its identity", () => {
    silenceConsole()

    const Menu = defineSlot("adapter.isolation")
    const reported: SlotError[] = []

    const chaos = definePlugin({
      id: "chaos",
      contributes: [
        Menu.contribute("boom", {
          component: () => {
            throw new Error("boom")
          },
        }),
        Menu.contribute("healthy", { component: () => <li>healthy</li> }),
      ],
    })

    const bystander = definePlugin({
      id: "bystander",
      contributes: [
        Menu.contribute("survivor", { component: () => <li>survivor</li> }),
      ],
    })

    render(
      <SlotProvider
        resolution={resolvePlugins([chaos, bystander])}
        onError={(error) => reported.push(error)}
      >
        <ul>
          <SlotHost slot={Menu} />
        </ul>
      </SlotProvider>,
    )

    // The failure costs one contribution its place, not the plugin's other
    // contribution and not the neighbouring plugin.
    expect(items()).toEqual(["healthy", "survivor"])
    expect(reported).toMatchObject([
      {
        pluginId: "chaos",
        contributionId: "boom",
        slot: "adapter.isolation",
      },
    ])
  })

  it("recovers through Failed's reset, and re-catches a repeat failure", async () => {
    silenceConsole()
    collectRecoveries()

    const Menu = defineSlot("adapter.reset")
    const reported: SlotError[] = []

    // Driven by the retry, not by a render count: React is free to re-invoke
    // a throwing component before it commits the error.
    let outcome: "boom 1" | "boom 2" | "ok" = "boom 1"

    const plugin = definePlugin({
      id: "flaky",
      contributes: [
        Menu.contribute("entry", {
          component: () => {
            if (outcome !== "ok") {
              throw new Error(outcome)
            }

            return <li>fixed</li>
          },
        }),
      ],
    })

    function Failed({ reset }: SlotError & { reset: () => void }) {
      return (
        <li>
          <button
            type="button"
            onClick={() => {
              outcome = outcome === "boom 1" ? "boom 2" : "ok"
              reset()
            }}
          >
            retry
          </button>
        </li>
      )
    }

    render(
      <SlotProvider
        resolution={resolvePlugins([plugin])}
        onError={(error) => reported.push(error)}
        Failed={Failed}
      >
        <ul>
          <SlotHost slot={Menu} />
        </ul>
      </SlotProvider>,
    )

    await userEvent.click(screen.getByRole("button", { name: "retry" }))

    // A retry that fails again is caught again rather than escaping the host.
    expect(reported.map((entry) => String(entry.error))).toEqual([
      "Error: boom 1",
      "Error: boom 2",
    ])

    await userEvent.click(screen.getByRole("button", { name: "retry" }))

    expect(items()).toEqual(["fixed"])
    expect(reported).toHaveLength(2)
  })

  it("does not loop when the host re-renders in response to an error", () => {
    silenceConsole()

    const Menu = defineSlot("adapter.error-loop")

    const plugin = definePlugin({
      id: "chaos",
      contributes: [
        Menu.contribute("boom", {
          component: () => {
            throw new Error("boom")
          },
        }),
      ],
    })

    function Harness() {
      const [errors, setErrors] = React.useState(0)
      const onError = React.useCallback(() => setErrors((prev) => prev + 1), [])

      return (
        <SlotProvider
          resolution={resolvePlugins([plugin])}
          onError={onError}
          Failed={() => <li>failed</li>}
        >
          <p data-testid="count">{errors}</p>
          <ul>
            <SlotHost slot={Menu} />
          </ul>
        </SlotProvider>
      )
    }

    render(<Harness />)

    expect(screen.getByTestId("count").textContent).toBe("1")
    expect(items()).toEqual(["failed"])
  })
})

describe("pending", () => {
  function deferred() {
    let loaded = false
    let release!: () => void
    let gate: Promise<void> | null = null

    function Deferred() {
      if (!loaded) {
        gate ??= new Promise<void>((resolve) => {
          release = () => {
            loaded = true
            resolve()
          }
        })

        throw gate
      }

      return <li>loaded</li>
    }

    return { Deferred, release: () => release() }
  }

  it("renders Pending while a contribution loads, identified", async () => {
    const Menu = defineSlot("adapter.pending")
    const { Deferred, release } = deferred()

    const plugin = definePlugin({
      id: "slow",
      contributes: [Menu.contribute("entry", { component: Deferred })],
    })

    render(
      <SlotProvider
        resolution={resolvePlugins([plugin])}
        Pending={({ pluginId, contributionId }) => (
          <li>
            loading {pluginId}/{contributionId}
          </li>
        )}
      >
        <ul>
          <SlotHost slot={Menu} />
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual(["loading slow/entry"])

    await React.act(async () => release())

    expect(items()).toEqual(["loaded"])
  })

  it("keeps the null fallback when Pending is not given", async () => {
    const Menu = defineSlot("adapter.pending-null")
    const { Deferred, release } = deferred()

    const plugin = definePlugin({
      id: "slow",
      contributes: [Menu.contribute("entry", { component: Deferred })],
    })

    render(
      <SlotProvider resolution={resolvePlugins([plugin])}>
        <ul>
          <SlotHost slot={Menu} />
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual([])

    await React.act(async () => release())

    expect(items()).toEqual(["loaded"])
  })
})

describe("hooks", () => {
  it("hands the host's props to contributions, typed by the slot", () => {
    type Props = { current: string }
    const Menu = defineSlot<Props>("adapter.props")

    function Item(props: Props) {
      const shared = useSlotProps(Menu)

      return (
        <li>
          {props.current} / {shared?.current ?? "none"}
        </li>
      )
    }

    const plugin = definePlugin({
      id: "p",
      contributes: [Menu.contribute("entry", { component: Item })],
    })

    render(
      <SlotProvider resolution={resolvePlugins([plugin])}>
        <ul>
          <SlotHost slot={Menu} props={{ current: "/pricing" }} />
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual(["/pricing / /pricing"])
  })

  it("returns null from useSlotProps outside any host", () => {
    const Menu = defineSlot<{ current: string }>("adapter.props-null")
    let seen: unknown = "unset"

    function Probe() {
      seen = useSlotProps(Menu)

      return null
    }

    render(
      <SlotProvider resolution={resolvePlugins([])}>
        <Probe />
      </SlotProvider>,
    )

    expect(seen).toBeNull()
  })

  it("holds props steady across value-equal rebuilds", () => {
    type Props = { current: string }
    const Menu = defineSlot<Props>("adapter.props-stable")
    let renders = 0

    function Item({ current }: Props) {
      renders++

      return <li>{current}</li>
    }

    const plugin = definePlugin({
      id: "p",
      contributes: [Menu.contribute("entry", { component: Item })],
    })

    const resolution = resolvePlugins([plugin])

    function App({ current, tick }: Props & { tick: number }) {
      return (
        <SlotProvider resolution={resolution}>
          <p>{tick}</p>
          <ul>
            {/* A fresh props object every render, equal by value. */}
            <SlotHost slot={Menu} props={{ current }} />
          </ul>
        </SlotProvider>
      )
    }

    const { rerender } = render(<App current="a" tick={1} />)

    rerender(<App current="a" tick={2} />)

    expect(renders).toBe(1)

    rerender(<App current="b" tick={3} />)

    expect(renders).toBe(2)
    expect(items()).toEqual(["b"])
  })

  it("identifies the rendering contribution to useContribution", () => {
    const Menu = defineSlot("adapter.contribution-id")
    let seen: unknown = null

    function Item() {
      seen = useContribution()

      return <li>item</li>
    }

    const plugin = definePlugin({
      id: "pricing",
      contributes: [Menu.contribute("nav-link", { component: Item })],
    })

    render(
      <SlotProvider resolution={resolvePlugins([plugin])}>
        <ul>
          <SlotHost slot={Menu} />
        </ul>
      </SlotProvider>,
    )

    expect(seen).toEqual({
      slot: "adapter.contribution-id",
      pluginId: "pricing",
      contributionId: "nav-link",
    })
  })

  it("throws from useContribution outside a contribution", () => {
    silenceConsole()

    function Probe() {
      useContribution()

      return null
    }

    expect(() => render(<Probe />)).toThrow(
      "[create-slot] 'useContribution' called outside of a plugin contribution",
    )
  })
})

describe("renderEntries", () => {
  it("hands the host's entries over, with identity and in order", () => {
    const Menu = defineSlot("adapter.render-entries")

    const plugin = definePlugin({
      id: "pricing",
      contributes: [
        Menu.contribute("b", { order: 2, component: () => <em>b</em> }),
        Menu.contribute("a", { order: 1, component: () => <em>a</em> }),
      ],
    })

    let received: readonly HostEntry[] = []

    render(
      <SlotProvider resolution={resolvePlugins([plugin])}>
        <ul>
          <SlotHost
            slot={Menu}
            renderEntries={(entries) => {
              received = entries

              return entries.map((entry) => (
                <li key={entry.key} data-plugin={entry.pluginId}>
                  {entry.node}
                </li>
              ))
            }}
          />
        </ul>
      </SlotProvider>,
    )

    expect(received.map((entry) => entry.key)).toEqual([
      "pricing/a",
      "pricing/b",
    ])
    expect(received.map((entry) => entry.order)).toEqual([1, 2])
    expect(items()).toEqual(["a", "b"])
    expect(
      Array.from(document.querySelectorAll("li[data-plugin='pricing']")),
    ).toHaveLength(2)
  })

  it("is called with zero entries and owns the empty state", () => {
    const Menu = defineSlot("adapter.render-entries-empty")

    render(
      <SlotProvider resolution={resolvePlugins([])}>
        <ul>
          <SlotHost
            slot={Menu}
            renderEntries={(entries) =>
              entries.length === 0 ? <li>custom empty</li> : null
            }
          />
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual(["custom empty"])
  })

  it("ignores children while renderEntries is set, and says so in dev", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    const Menu = defineSlot("adapter.render-entries-conflict")

    render(
      <SlotProvider resolution={resolvePlugins([])}>
        <ul>
          <SlotHost slot={Menu} renderEntries={() => <li>owned</li>}>
            <li>ignored placeholder</li>
          </SlotHost>
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual(["owned"])
    expect(
      errors.mock.calls.some((call) =>
        String(call[0]).includes("children are ignored"),
      ),
    ).toBe(true)
  })
})

describe("descriptor anchoring", () => {
  it("serves a frozen descriptor through the fallback registry", () => {
    // Descriptors are pure data, so freezing one is a legitimate user move —
    // the props context then cannot live on the object and must fall back.
    const Menu = Object.freeze(
      defineSlot<{ current: string }>("adapter.frozen"),
    )

    function Item() {
      return <li>{useSlotProps(Menu)?.current ?? "none"}</li>
    }

    const plugin = definePlugin({
      id: "p",
      contributes: [Menu.contribute("entry", { component: Item })],
    })

    render(
      <SlotProvider resolution={resolvePlugins([plugin])}>
        <ul>
          <SlotHost slot={Menu} props={{ current: "/pricing" }} />
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual(["/pricing"])
  })

  it("does not leak the cached context into a spread clone", () => {
    const Menu = defineSlot<{ current: string }>("adapter.spread")

    // Prime the cache, then clone: the property is non-enumerable, so the
    // clone is a clean descriptor of its own, not a half-shared one.
    propsContextOf(Menu)

    const clone = { ...Menu }

    expect(propsContextOf(clone)).not.toBe(propsContextOf(Menu))
  })
})

describe("adapter copies", () => {
  it("resolves one props context per descriptor across module copies", async () => {
    const Menu = defineSlot<{ current: string }>("adapter.copies")
    const first = propsContextOf(Menu)

    vi.resetModules()

    const second = await import("./hooks")

    // Two genuinely different module instances…
    expect(second.propsContextOf).not.toBe(propsContextOf)
    // …still meet in the descriptor's own cached context.
    expect(second.propsContextOf(Menu)).toBe(first)
  })
})

describe("ported registry coverage", () => {
  it("adds and removes plugins at runtime, keeping the survivors mounted", () => {
    const Menu = defineSlot("adapter.survivors")
    let mounts = 0

    function Survivor() {
      React.useEffect(() => {
        mounts++
      }, [])

      return <li>survivor</li>
    }

    const survivor = definePlugin({
      id: "survivor",
      contributes: [Menu.contribute("entry", { component: Survivor })],
    })

    const guest = definePlugin({
      id: "guest",
      contributes: [
        Menu.contribute("entry", { order: 1, component: () => <li>guest</li> }),
      ],
    })

    function App({ withGuest }: { withGuest: boolean }) {
      const resolution = React.useMemo(
        () => resolvePlugins(withGuest ? [survivor, guest] : [survivor]),
        [withGuest],
      )

      return (
        <SlotProvider resolution={resolution}>
          <ul>
            <SlotHost slot={Menu} />
          </ul>
        </SlotProvider>
      )
    }

    const { rerender } = render(<App withGuest={false} />)

    rerender(<App withGuest={true} />)

    expect(items()).toEqual(["survivor", "guest"])

    rerender(<App withGuest={false} />)

    expect(items()).toEqual(["survivor"])
    // The stable full id keeps the survivor's React identity through both
    // graph changes: mounted once, never remounted.
    expect(mounts).toBe(1)
  })

  it("catches a thrown value that is not an Error", () => {
    silenceConsole()

    const Menu = defineSlot("adapter.non-error")
    const reported: SlotError[] = []

    const plugin = definePlugin({
      id: "chaos",
      contributes: [
        Menu.contribute("boom", {
          component: () => {
            // Throwing a bare string is the point of the test.
            // eslint-free zone: biome has no rule against it, React reports
            // the value as-is and the boundary must carry it unchanged.
            throw "just a string"
          },
        }),
      ],
    })

    render(
      <SlotProvider
        resolution={resolvePlugins([plugin])}
        onError={(error) => reported.push(error)}
        Failed={({ error }) => <li>caught {String(error)}</li>}
      >
        <ul>
          <SlotHost slot={Menu} />
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual(["caught just a string"])
    expect(reported[0]?.error).toBe("just a string")
  })

  it("counts a contribution that renders nothing as contributed", () => {
    const Menu = defineSlot("adapter.renders-null")

    const plugin = definePlugin({
      id: "quiet",
      contributes: [Menu.contribute("entry", { component: () => null })],
    })

    render(
      <SlotProvider resolution={resolvePlugins([plugin])}>
        <ul>
          <SlotHost slot={Menu}>
            <li>placeholder</li>
          </SlotHost>
        </ul>
      </SlotProvider>,
    )

    // Contributed-but-invisible is the component's own decision; the
    // placeholder is only for a slot nothing addressed.
    expect(items()).toEqual([])
  })

  it("isolates a contribution that only starts failing on an update", async () => {
    silenceConsole()
    collectRecoveries()

    const Menu = defineSlot<{ mode: string }>("adapter.late-failure")

    function Fragile({ mode }: { mode: string }) {
      if (mode === "broken") {
        throw new Error("late boom")
      }

      return <li>fragile</li>
    }

    const plugin = definePlugin({
      id: "fragile",
      contributes: [
        Menu.contribute("entry", { component: Fragile }),
        Menu.contribute("steady", {
          order: 1,
          component: () => <li>steady</li>,
        }),
      ],
    })

    const resolution = resolvePlugins([plugin])

    function App({ mode }: { mode: string }) {
      return (
        <SlotProvider resolution={resolution} Failed={() => <li>failed</li>}>
          <ul>
            <SlotHost slot={Menu} props={{ mode }} />
          </ul>
        </SlotProvider>
      )
    }

    const { rerender } = render(<App mode="fine" />)

    expect(items()).toEqual(["fragile", "steady"])

    rerender(<App mode="broken" />)

    expect(items()).toEqual(["failed", "steady"])
  })

  it("catches a contribution whose code never arrives", async () => {
    silenceConsole()

    const Menu = defineSlot("adapter.never-arrives")
    const reported: SlotError[] = []
    const Missing = React.lazy<React.ComponentType>(() =>
      Promise.reject(new Error("chunk gone")),
    )

    const plugin = definePlugin({
      id: "split",
      contributes: [
        Menu.contribute("missing", {
          order: 0,
          component: Missing as unknown as React.ComponentType<object>,
        }),
        Menu.contribute("healthy", {
          order: 1,
          component: () => <li>healthy</li>,
        }),
      ],
    })

    await React.act(async () => {
      render(
        <SlotProvider
          resolution={resolvePlugins([plugin])}
          onError={(error) => reported.push(error)}
          Failed={({ error }) => <li>{String(error)}</li>}
        >
          <ul>
            <SlotHost slot={Menu} />
          </ul>
        </SlotProvider>,
      )
    })

    // A rejected import reaches the boundary through the same `Suspense` that
    // was there to let it load, so a lost chunk costs one line of the page.
    expect(items()).toEqual(["Error: chunk gone", "healthy"])
    expect(reported).toMatchObject([
      { pluginId: "split", contributionId: "missing" },
    ])
  })

  it("does not isolate the host's own failure handlers", () => {
    silenceConsole()

    const Menu = defineSlot("adapter.handler-throws")

    const plugin = definePlugin({
      id: "chaos",
      contributes: [
        Menu.contribute("boom", {
          component: () => {
            throw new Error("boom")
          },
        }),
      ],
    })

    function BrokenFailed(): never {
      throw new Error("the handler itself is broken")
    }

    // A broken Failed component is the application's bug, not a plugin's; the
    // library must not swallow it into the same boundary it renders into.
    expect(() =>
      render(
        <SlotProvider
          resolution={resolvePlugins([plugin])}
          Failed={BrokenFailed}
        >
          <ul>
            <SlotHost slot={Menu} />
          </ul>
        </SlotProvider>,
      ),
    ).toThrow("the handler itself is broken")
  })

  it("re-renders a contribution when the host's prop names change", () => {
    const Menu = defineSlot<Record<string, unknown>>("adapter.prop-names")
    let renders = 0

    function Probe(props: Record<string, unknown>) {
      renders++

      return <li>{Object.keys(props).join(",")}</li>
    }

    const plugin = definePlugin({
      id: "p",
      contributes: [Menu.contribute("entry", { component: Probe })],
    })

    const resolution = resolvePlugins([plugin])

    function App({ props }: { props: Record<string, unknown> }) {
      return (
        <SlotProvider resolution={resolution}>
          <ul>
            <SlotHost slot={Menu} props={props} />
          </ul>
        </SlotProvider>
      )
    }

    // Same key count, undefined values, different names: still a change.
    const { rerender } = render(<App props={{ a: undefined }} />)

    expect(renders).toBe(1)

    rerender(<App props={{ b: undefined }} />)

    expect(renders).toBe(2)
    expect(items()).toEqual(["b"])
  })

  it("holds a NaN prop steady and treats -0 as a change", () => {
    const Menu = defineSlot<{ value: number }>("adapter.object-is")
    let renders = 0

    function Probe() {
      renders++

      return <li>probe</li>
    }

    const plugin = definePlugin({
      id: "p",
      contributes: [Menu.contribute("entry", { component: Probe })],
    })

    const resolution = resolvePlugins([plugin])

    function App({ value }: { value: number }) {
      return (
        <SlotProvider resolution={resolution}>
          <ul>
            <SlotHost slot={Menu} props={{ value }} />
          </ul>
        </SlotProvider>
      )
    }

    const { rerender } = render(<App value={Number.NaN} />)

    rerender(<App value={Number.NaN} />)

    expect(renders).toBe(1)

    rerender(<App value={-0} />)

    expect(renders).toBe(2)
  })

  it("never forwards the host's children to a contribution", () => {
    const Menu = defineSlot<{ current: string }>("adapter.no-children")
    let seen: string[] = []

    function Probe(props: { current: string }) {
      seen = Object.keys(props)

      return <li>probe</li>
    }

    const plugin = definePlugin({
      id: "p",
      contributes: [Menu.contribute("entry", { component: Probe })],
    })

    render(
      <SlotProvider resolution={resolvePlugins([plugin])}>
        <ul>
          <SlotHost slot={Menu} props={{ current: "/" }}>
            <li>placeholder</li>
          </SlotHost>
        </ul>
      </SlotProvider>,
    )

    // `props` is an explicit bag in v4, so this is structural: the host's
    // children simply never enter it.
    expect(seen).toEqual(["current"])
  })

  it("hosts one slot inside another slot's contribution", () => {
    const Outer = defineSlot("adapter.outer")
    const Inner = defineSlot("adapter.inner")

    const plugin = definePlugin({
      id: "nested",
      contributes: [
        Outer.contribute("shell", {
          component: () => (
            <li>
              outer
              <ul>
                <SlotHost slot={Inner} />
              </ul>
            </li>
          ),
        }),
        Inner.contribute("leaf", { component: () => <li>inner</li> }),
      ],
    })

    render(
      <SlotProvider resolution={resolvePlugins([plugin])}>
        <ul>
          <SlotHost slot={Outer} />
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual(["outerinner", "inner"])
  })
})

describe("dev diagnostics ergonomics", () => {
  it("treats a slot nobody contributed to as legal and quiet", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    const Quiet = defineSlot("adapter.quiet-empty")

    render(
      <SlotProvider resolution={resolvePlugins([])}>
        <ul>
          <SlotHost slot={Quiet}>
            <li>placeholder</li>
          </SlotHost>
        </ul>
      </SlotProvider>,
    )

    expect(items()).toEqual(["placeholder"])
    expect(
      errors.mock.calls.some((call) =>
        String(call[0]).includes("[create-slot]"),
      ),
    ).toBe(false)
  })

  it("skips diagnostic logging when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.resetModules()

    const errors: string[] = []

    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "))
    })

    // A fresh module graph, because the check is decided once, at import.
    const released = await import("./provider")
    const releasedHost = await import("./host")
    const core = await import("../core")

    const Menu = core.defineSlot("adapter.production")

    const resolution = core.resolvePlugins([], {
      disable: { plugins: ["ghost"] },
    })

    // The resolver still reports — diagnostics are data, not logging…
    expect(resolution.diagnostics).toHaveLength(1)

    render(
      <released.SlotProvider resolution={resolution}>
        <ul>
          <releasedHost.SlotHost
            slot={Menu}
            renderEntries={() => <li>owned</li>}
          >
            <li>ignored</li>
          </releasedHost.SlotHost>
        </ul>
      </released.SlotProvider>,
    )

    // …but a shipped build pays nothing to print them, and the
    // renderEntries-with-children warning is stripped with it.
    expect(errors.join("\n")).not.toContain("[create-slot]")
  })
})
