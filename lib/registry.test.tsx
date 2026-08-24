import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  type Contribution,
  definePlugin,
  defineSlot,
  type PluginError,
  PluginProvider,
  usePluginId,
} from "./create-slot"

function items(): string[] {
  return Array.from(document.querySelectorAll("li")).map(
    (li) => li.textContent?.trim() ?? "",
  )
}

function silenceConsole() {
  vi.spyOn(console, "error").mockImplementation(() => {})
}

let stopCollecting: (() => void) | null = null

/**
 * A render that throws and is then retried concurrently reaches React's
 * `reportError`, which jsdom turns into a window error event and the runner
 * counts as an unhandled failure. Tests that provoke one own it.
 */
function collectRecoveries(): string[] {
  const recovered: string[] = []

  const onError = (event: ErrorEvent) => {
    event.preventDefault()
    recovered.push(String(event.error ?? event.message))
  }

  window.addEventListener("error", onError)
  stopCollecting = () => window.removeEventListener("error", onError)

  return recovered
}

afterEach(() => {
  stopCollecting?.()
  stopCollecting = null
  vi.restoreAllMocks()
})

describe("registry ordering", () => {
  it("sorts by order, then by plugin position, then by declaration position", () => {
    const NavMenu = defineSlot("ordering-full")

    const first = definePlugin({
      id: "first",
      contributes: [
        NavMenu.contribute({ order: 20, component: () => <li>first 20</li> }),
        // Two of one plugin's own contributions at the same rank: an
        // array-index `order` would have dropped one of them.
        NavMenu.contribute({ component: () => <li>first tie a</li> }),
        NavMenu.contribute({ component: () => <li>first tie b</li> }),
      ],
    })

    const second = definePlugin({
      id: "second",
      contributes: [
        NavMenu.contribute({ order: 10, component: () => <li>second 10</li> }),
        NavMenu.contribute({ component: () => <li>second tie</li> }),
      ],
    })

    render(
      <PluginProvider plugins={[first, second]}>
        <ul>
          <NavMenu.Host />
        </ul>
      </PluginProvider>,
    )

    // The default order is 0, so every tie lands ahead of the ranked pair, and
    // list position — not mount time — decides between plugins.
    expect(items()).toEqual([
      "first tie a",
      "first tie b",
      "second tie",
      "second 10",
      "first 20",
    ])
  })

  it("keeps every contribution when an order is not a finite number", () => {
    const NavMenu = defineSlot("ordering-nonfinite")

    const plugin = definePlugin({
      id: "edges",
      contributes: [
        NavMenu.contribute({
          order: Number.POSITIVE_INFINITY,
          component: () => <li>last a</li>,
        }),
        NavMenu.contribute({ order: 0, component: () => <li>middle</li> }),
        NavMenu.contribute({
          order: Number.POSITIVE_INFINITY,
          component: () => <li>last b</li>,
        }),
        NavMenu.contribute({
          order: Number.NEGATIVE_INFINITY,
          component: () => <li>first</li>,
        }),
      ],
    })

    render(
      <PluginProvider plugins={[plugin]}>
        <ul>
          <NavMenu.Host />
        </ul>
      </PluginProvider>,
    )

    // `Infinity - Infinity` is NaN, which the comparator's `||` chain treats as
    // a tie rather than as a corrupt sort: both ends stay usable as "always
    // first" and "always last".
    expect(items()).toEqual(["first", "middle", "last a", "last b"])
  })

  it("passes the host's own props to every contribution", () => {
    const Toolbar = defineSlot<{ scope: "list" | "detail" }>("ordering-props")

    const plugin = definePlugin({
      id: "pricing",
      contributes: [
        Toolbar.contribute({
          component: ({ scope }) =>
            scope === "detail" ? <li>detail</li> : null,
        }),
      ],
    })

    render(
      <PluginProvider plugins={[plugin]}>
        <ul>
          <Toolbar.Host scope="list" />
          <Toolbar.Host scope="detail" />
        </ul>
      </PluginProvider>,
    )

    // One contribution, two hosts, and each decides its own visibility.
    expect(items()).toEqual(["detail"])
  })

  it("renders nothing for a slot no plugin contributes to", () => {
    const Empty = defineSlot("ordering-empty")

    render(
      <PluginProvider plugins={[]}>
        <ul>
          <Empty.Host />
        </ul>
      </PluginProvider>,
    )

    expect(document.querySelector("ul")?.innerHTML).toBe("")
  })
})

describe("registry provider", () => {
  it("throws when a host renders outside the provider", () => {
    silenceConsole()

    const Orphan = defineSlot("provider-orphan")

    expect(() => render(<Orphan.Host />)).toThrow(
      "[create-slot] Slot host rendered outside of 'PluginProvider'",
    )
  })

  it("lets a nested provider shadow the outer one", () => {
    const Menu = defineSlot("provider-nested")

    const outer = definePlugin({
      id: "outer",
      contributes: [Menu.contribute({ component: () => <li>outer</li> })],
    })

    const inner = definePlugin({
      id: "inner",
      contributes: [Menu.contribute({ component: () => <li>inner</li> })],
    })

    render(
      <PluginProvider plugins={[outer]}>
        <ul data-testid="outer">
          <Menu.Host />
        </ul>
        <PluginProvider plugins={[inner]}>
          <ul data-testid="inner">
            <Menu.Host />
          </ul>
        </PluginProvider>
      </PluginProvider>,
    )

    // Nesting replaces the plugin list for the subtree; it does not add to it.
    expect(screen.getByTestId("outer").textContent).toBe("outer")
    expect(screen.getByTestId("inner").textContent).toBe("inner")
  })

  it("does not remount contributions when the plugins array is rebuilt", () => {
    const Menu = defineSlot("provider-identity")
    let mounts = 0

    function Item() {
      React.useEffect(() => {
        mounts++
      }, [])

      return <li>item</li>
    }

    const plugin = definePlugin({
      id: "stable",
      contributes: [Menu.contribute({ component: Item })],
    })

    function App({ tick }: { tick: number }) {
      // A fresh array literal every render: the common way to pass a filtered
      // plugin list, and the index is rebuilt each time it changes.
      return (
        <PluginProvider plugins={[plugin]}>
          <p>{tick}</p>
          <ul>
            <Menu.Host />
          </ul>
        </PluginProvider>
      )
    }

    const { rerender } = render(<App tick={0} />)
    rerender(<App tick={1} />)
    rerender(<App tick={2} />)

    // Rebuilt entries still carry the same React key, so the contribution is
    // reconciled rather than torn down and remounted.
    expect(mounts).toBe(1)
    expect(items()).toEqual(["item"])
  })

  it("adds and removes plugins at runtime, keeping the survivors mounted", () => {
    const Menu = defineSlot("provider-churn")
    let mounts = 0

    function Stable() {
      React.useEffect(() => {
        mounts++
      }, [])

      return <li>stable</li>
    }

    const stable = definePlugin({
      id: "stable",
      contributes: [Menu.contribute({ order: 0, component: Stable })],
    })

    const late = definePlugin({
      id: "late",
      contributes: [
        Menu.contribute({ order: 10, component: () => <li>late</li> }),
      ],
    })

    function App({ withLate }: { withLate: boolean }) {
      return (
        <PluginProvider plugins={withLate ? [stable, late] : [stable]}>
          <ul>
            <Menu.Host />
          </ul>
        </PluginProvider>
      )
    }

    const { rerender } = render(<App withLate={false} />)
    expect(items()).toEqual(["stable"])

    rerender(<App withLate={true} />)
    expect(items()).toEqual(["stable", "late"])

    rerender(<App withLate={false} />)
    expect(items()).toEqual(["stable"])
    expect(mounts).toBe(1)
  })
})

describe("registry isolation", () => {
  it("contains a throwing contribution and reports it", () => {
    silenceConsole()

    const reported: PluginError[] = []
    const NavMenu = defineSlot("isolation-contains")

    const chaos = definePlugin({
      id: "chaos",
      contributes: [
        NavMenu.contribute({
          order: 0,
          component: () => {
            throw new Error("boom")
          },
        }),
        NavMenu.contribute({ order: 1, component: () => <li>survivor</li> }),
      ],
    })

    const healthy = definePlugin({
      id: "healthy",
      contributes: [NavMenu.contribute({ component: () => <li>healthy</li> })],
    })

    render(
      <PluginProvider
        plugins={[chaos, healthy]}
        onError={(error) => reported.push(error)}
        renderFailed={({ pluginId }) => <li>{pluginId} failed</li>}
      >
        <ul>
          <NavMenu.Host />
        </ul>
      </PluginProvider>,
    )

    // The failure costs one contribution its place, not the plugin's other
    // contribution and not the neighbouring plugin.
    expect(items()).toEqual(["chaos failed", "healthy", "survivor"])
    expect(reported).toMatchObject([
      { pluginId: "chaos", slot: "isolation-contains" },
    ])
  })

  it("recovers through the reset it was given, and re-catches a repeat failure", async () => {
    silenceConsole()
    collectRecoveries()

    const NavMenu = defineSlot("isolation-reset")
    const reported: PluginError[] = []

    // Driven by the retry, not by a render count: React is free to re-invoke a
    // throwing component before it commits the error.
    let outcome: "boom 1" | "boom 2" | "ok" = "boom 1"

    const plugin = definePlugin({
      id: "flaky",
      contributes: [
        NavMenu.contribute({
          component: () => {
            if (outcome !== "ok") {
              throw new Error(outcome)
            }

            return <li>fixed</li>
          },
        }),
      ],
    })

    render(
      <PluginProvider
        plugins={[plugin]}
        onError={(error) => reported.push(error)}
        renderFailed={({ reset }) => (
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
        )}
      >
        <ul>
          <NavMenu.Host />
        </ul>
      </PluginProvider>,
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

    const NavMenu = defineSlot("isolation-loop")

    const plugin = definePlugin({
      id: "chaos",
      contributes: [
        NavMenu.contribute({
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
        <PluginProvider
          plugins={[plugin]}
          onError={onError}
          renderFailed={() => <li>failed</li>}
        >
          <p>errors: {errors}</p>
          <ul>
            <NavMenu.Host />
          </ul>
        </PluginProvider>
      )
    }

    render(<Harness />)

    // The boundary has no reset-on-update, so reporting an error cannot make
    // the contribution retry and report again.
    expect(screen.getByText("errors: 1")).toBeInTheDocument()
  })

  it("catches a thrown value that is not an Error", () => {
    silenceConsole()

    const NavMenu = defineSlot("isolation-nonerror")
    const reported: unknown[] = []

    const plugin = definePlugin({
      id: "sloppy",
      contributes: [
        NavMenu.contribute({
          order: 0,
          component: () => {
            throw null
          },
        }),
        NavMenu.contribute({
          order: 1,
          component: () => {
            throw "just a string"
          },
        }),
      ],
    })

    render(
      <PluginProvider
        plugins={[plugin]}
        onError={({ error }) => reported.push(error)}
        renderFailed={({ error }) => <li>{String(error)}</li>}
      >
        <ul>
          <NavMenu.Host />
        </ul>
      </PluginProvider>,
    )

    // A thrown `null` cannot be held as boundary state — that is the "no error"
    // value — so the fallback is shown a stand-in while `onError` still gets
    // exactly what the contribution threw.
    expect(items()).toEqual([
      "Error: Plugin threw a non-error value",
      "just a string",
    ])
    expect(reported).toEqual([null, "just a string"])
  })

  it("counts a contribution that renders nothing as contributed", () => {
    const Menu = defineSlot("isolation-invisible")
    const pending = new Promise<never>(() => {})

    const plugin = definePlugin({
      id: "quiet",
      contributes: [
        Menu.contribute({ order: 0, component: () => null }),
        Menu.contribute({
          order: 1,
          component: () => {
            throw pending
          },
        }),
      ],
    })

    const { container } = render(
      <PluginProvider plugins={[plugin]}>
        <ul>
          <Menu.Host>
            <li>placeholder</li>
          </Menu.Host>
        </ul>
      </PluginProvider>,
    )

    // The placeholder answers "is anything contributed", not "is anything
    // visible": a contribution that renders null, and one still suspended
    // behind the host's own `Suspense`, both keep it away.
    expect(container.querySelector("ul")?.innerHTML).toBe("")
  })

  it("does not isolate a runtime fill that throws", () => {
    silenceConsole()

    const Menu = defineSlot("isolation-runtime")

    function Boom(): React.ReactElement {
      throw new Error("runtime boom")
    }

    // Only the declarative channel is wrapped in a boundary: a fill's element
    // is rendered as it was given. Whoever mounts one owns its failures.
    expect(() =>
      render(
        <PluginProvider plugins={[]} renderFailed={() => <li>failed</li>}>
          <ul>
            <Menu.Host />
          </ul>
          <Menu.Fill>
            <Boom />
          </Menu.Fill>
        </PluginProvider>,
      ),
    ).toThrow("runtime boom")
  })
})

describe("registry identity and manifests", () => {
  it("tells a contribution which plugin it belongs to", () => {
    const NavMenu = defineSlot("identity-plugin")

    function Item() {
      return <li>{usePluginId()}</li>
    }

    const plugin = definePlugin({
      id: "pricing",
      contributes: [NavMenu.contribute({ component: Item })],
    })

    render(
      <PluginProvider plugins={[plugin]}>
        <ul>
          <NavMenu.Host />
        </ul>
      </PluginProvider>,
    )

    expect(items()).toEqual(["pricing"])
  })

  it("throws when usePluginId is called outside a contribution", () => {
    silenceConsole()

    const Menu = defineSlot("identity-orphan")

    function Item() {
      return <li>{usePluginId()}</li>
    }

    // A runtime fill belongs to no plugin, so there is no id to hand back.
    expect(() =>
      render(
        <PluginProvider plugins={[]}>
          <ul>
            <Menu.Host />
          </ul>
          <Menu.Fill>
            <Item />
          </Menu.Fill>
        </PluginProvider>,
      ),
    ).toThrow(
      "[create-slot] 'usePluginId' called outside of a plugin contribution",
    )
  })

  it("warns about a duplicate plugin id, its one manifest invariant", () => {
    const errors: string[] = []
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(String(args[0]))
    })

    const NavMenu = defineSlot("identity-duplicate")

    const make = (label: string) =>
      definePlugin({
        id: "same",
        contributes: [
          NavMenu.contribute({ component: () => <li>{label}</li> }),
        ],
      })

    render(
      <PluginProvider plugins={[make("a"), make("b")]}>
        <ul>
          <NavMenu.Host />
        </ul>
      </PluginProvider>,
    )

    expect(errors.join("\n")).toContain('Duplicate plugin id "same"')
    // Warned about, not repaired: colliding keys are why it is worth saying.
    expect(items()).toEqual(["a", "b"])
  })

  it("rejects an empty plugin id and an empty slot name", () => {
    // Both are registry keys, and both fail where they are written rather than
    // silently sharing a bucket with something else.
    expect(() => definePlugin({ id: "" })).toThrow(
      "[create-slot] 'definePlugin' requires a non-empty id",
    )
    expect(() => defineSlot("")).toThrow(
      "[create-slot] 'defineSlot' requires a non-empty name",
    )
  })

  it("keeps application-defined manifest fields typed", () => {
    // Titles, capability keys, routes, reducers: the library reads none of
    // them, and `definePlugin` still preserves their types.
    const plugin = definePlugin({
      id: "pricing",
      title: "Pricing",
      provides: ["route:/pricing"],
      routes: { "/pricing": () => <p>page</p> },
    })

    expect(plugin.title.toUpperCase()).toBe("PRICING")
    expect(Object.keys(plugin.routes)).toEqual(["/pricing"])
  })
})

describe("registry channels", () => {
  it("ranks runtime fills against declared ones, declared first on a tie", () => {
    const Menu = defineSlot("channels-rank")

    const plugin = definePlugin({
      id: "declared",
      contributes: [
        Menu.contribute({ order: 0, component: () => <li>declared 0</li> }),
        Menu.contribute({ order: 20, component: () => <li>declared 20</li> }),
      ],
    })

    render(
      <PluginProvider plugins={[plugin]}>
        <ul>
          <Menu.Host />
        </ul>
        <Menu.Fill order={10}>
          <li>runtime 10</li>
        </Menu.Fill>
        <Menu.Fill order={0}>
          <li>runtime 0</li>
        </Menu.Fill>
      </PluginProvider>,
    )

    // On a tie the declared one keeps the position the server already gave it.
    expect(items()).toEqual([
      "declared 0",
      "runtime 0",
      "runtime 10",
      "declared 20",
    ])
  })

  it("drops a runtime fill when it unmounts", () => {
    const Menu = defineSlot("channels-unmount")

    const plugin = definePlugin({
      id: "declared",
      contributes: [Menu.contribute({ component: () => <li>declared</li> })],
    })

    function App({ mounted }: { mounted: boolean }) {
      return (
        <PluginProvider plugins={[plugin]}>
          <ul>
            <Menu.Host />
          </ul>
          {mounted && (
            <Menu.Fill order={10}>
              <li>runtime</li>
            </Menu.Fill>
          )}
        </PluginProvider>
      )
    }

    const { rerender } = render(<App mounted={true} />)
    expect(items()).toEqual(["declared", "runtime"])

    rerender(<App mounted={false} />)
    expect(items()).toEqual(["declared"])
  })

  it("hands the host's props to a runtime fill through useProps", () => {
    const Toolbar = defineSlot<{ scope: string }>("channels-props")

    function Label() {
      return <li>{Toolbar.useProps()?.scope}</li>
    }

    render(
      <PluginProvider plugins={[]}>
        <ul>
          <Toolbar.Host scope="detail" />
        </ul>
        <Toolbar.Fill>
          <Label />
        </Toolbar.Fill>
      </PluginProvider>,
    )

    expect(items()).toEqual(["detail"])
  })

  it("renders the host's own children only while nothing is contributed", () => {
    const Menu = defineSlot("channels-placeholder")

    function App({ mounted }: { mounted: boolean }) {
      return (
        <PluginProvider plugins={[]}>
          <ul>
            <Menu.Host>
              <li>placeholder</li>
            </Menu.Host>
          </ul>
          {mounted && (
            <Menu.Fill>
              <li>runtime</li>
            </Menu.Fill>
          )}
        </PluginProvider>
      )
    }

    const { rerender } = render(<App mounted={false} />)
    expect(items()).toEqual(["placeholder"])

    rerender(<App mounted={true} />)
    expect(items()).toEqual(["runtime"])

    rerender(<App mounted={false} />)
    expect(items()).toEqual(["placeholder"])
  })

  it("shares one bucket between two definitions of the same name, but not their props", () => {
    const Left = defineSlot<{ scope: string }>("channels-shared-name")
    const Right = defineSlot<{ scope: string }>("channels-shared-name")

    function Peek() {
      return (
        <li>
          left={String(Left.useProps()?.scope)} right=
          {String(Right.useProps()?.scope)}
        </li>
      )
    }

    const plugin = definePlugin({
      id: "declared",
      contributes: [Right.contribute({ component: Peek })],
    })

    render(
      <PluginProvider plugins={[plugin]}>
        <ul>
          <Left.Host scope="from-left" />
        </ul>
      </PluginProvider>,
    )

    // The registry is keyed by name, so the two definitions are one slot — but
    // each keeps its own props context, and only the host's own reads back.
    expect(items()).toEqual(["left=from-left right=undefined"])
  })
})

describe("registry contract", () => {
  it("makes a contribution plain data, addressed to its slot", () => {
    const Menu = defineSlot("contract-data")
    const Item = () => <li>item</li>

    const contribution: Contribution = Menu.contribute({ component: Item })

    // The host renders it, so the whole list is knowable synchronously — which
    // is the property a server render depends on.
    expect(contribution).toEqual({
      slot: "contract-data",
      order: 0,
      component: Item,
    })
  })
})
