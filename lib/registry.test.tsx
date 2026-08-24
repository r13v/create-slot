import { act, render, screen } from "@testing-library/react"
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
        NavMenu.contribute({
          order: 2,
          component: () => {
            // Falsy, and still a failure: `0` is what a boundary written
            // around a truthiness check would have gone on rendering.
            throw 0
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
      "0",
    ])
    expect(reported).toEqual([null, "just a string", 0])
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

    // A runtime fill gets a Suspense boundary, but no error boundary: whoever
    // mounts one still owns its failures.
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

  it("isolates a contribution that only starts failing on an update", async () => {
    silenceConsole()

    const Toolbar = defineSlot<{ crash: boolean }>("isolation-late")
    const reported: PluginError[] = []

    function Neighbour() {
      const [n, bump] = React.useReducer((x: number) => x + 1, 0)

      return (
        <li>
          <button type="button" onClick={bump}>
            n {n}
          </button>
        </li>
      )
    }

    const plugin = definePlugin({
      id: "late",
      contributes: [
        Toolbar.contribute({
          order: 0,
          component: ({ crash }) => {
            if (crash) {
              throw new Error("late boom")
            }

            return <li>fine</li>
          },
        }),
        Toolbar.contribute({ order: 1, component: Neighbour }),
      ],
    })

    function App({ crash }: { crash: boolean }) {
      return (
        <PluginProvider
          plugins={[plugin]}
          onError={(error) => reported.push(error)}
          renderFailed={() => <li>failed</li>}
        >
          <ul>
            <Toolbar.Host crash={crash} />
          </ul>
        </PluginProvider>
      )
    }

    const { rerender } = render(<App crash={false} />)

    await userEvent.click(screen.getByRole("button"))
    expect(items()).toEqual(["fine", "n 1"])

    rerender(<App crash={true} />)

    // A failure that arrives on the tenth render is still one contribution's
    // failure: the neighbour is not remounted, so it keeps the state it had.
    expect(items()).toEqual(["failed", "n 1"])
    expect(reported).toHaveLength(1)
  })

  it("catches a contribution whose code never arrives", async () => {
    silenceConsole()

    const Menu = defineSlot("isolation-lazy")
    const reported: PluginError[] = []
    const Missing = React.lazy<React.ComponentType>(() =>
      Promise.reject(new Error("chunk gone")),
    )

    const plugin = definePlugin({
      id: "split",
      contributes: [
        Menu.contribute({ order: 0, component: Missing }),
        Menu.contribute({ order: 1, component: () => <li>healthy</li> }),
      ],
    })

    await act(async () => {
      render(
        <PluginProvider
          plugins={[plugin]}
          onError={(error) => reported.push(error)}
          renderFailed={({ error }) => <li>{String(error)}</li>}
        >
          <ul>
            <Menu.Host />
          </ul>
        </PluginProvider>,
      )
    })

    // A rejected import reaches the boundary through the same `Suspense` that
    // was there to let it load, so a lost chunk costs one line of the page.
    expect(items()).toEqual(["Error: chunk gone", "healthy"])
    expect(reported).toMatchObject([{ pluginId: "split" }])
  })

  it("drops a failing contribution when nothing was given to handle it", () => {
    silenceConsole()

    const Menu = defineSlot("isolation-unhandled")

    const plugin = definePlugin({
      id: "chaos",
      contributes: [
        Menu.contribute({
          order: 0,
          component: () => {
            throw new Error("boom")
          },
        }),
        Menu.contribute({ order: 1, component: () => <li>survivor</li> }),
      ],
    })

    // No `onError`, no `renderFailed`: isolation is not something the host has
    // to opt into, and the failure costs its neighbour nothing.
    render(
      <PluginProvider plugins={[plugin]}>
        <ul>
          <Menu.Host />
        </ul>
      </PluginProvider>,
    )

    expect(items()).toEqual(["survivor"])
  })

  it("does not isolate the host's own failure handlers", () => {
    silenceConsole()

    const Menu = defineSlot("isolation-handlers")

    const plugin = definePlugin({
      id: "chaos",
      contributes: [
        Menu.contribute({
          component: () => {
            throw new Error("boom")
          },
        }),
      ],
    })

    const tree = (handlers: {
      onError?: () => void
      renderFailed?: () => React.ReactNode
    }) => (
      <PluginProvider plugins={[plugin]} {...handlers}>
        <ul>
          <Menu.Host />
        </ul>
      </PluginProvider>
    )

    // The boundary is the contribution's, not the application's: a fallback
    // that throws has nothing beneath it to catch, and neither has `onError`.
    expect(() =>
      render(
        tree({
          renderFailed: () => {
            throw new Error("fallback boom")
          },
        }),
      ),
    ).toThrow("fallback boom")

    expect(() =>
      render(
        tree({
          onError: () => {
            throw new Error("handler boom")
          },
          renderFailed: () => <li>failed</li>,
        }),
      ),
    ).toThrow("handler boom")
  })

  it("ignores a reset that arrives after the host is gone", () => {
    silenceConsole()

    const Menu = defineSlot("isolation-late-reset")
    let retry: (() => void) | null = null

    const plugin = definePlugin({
      id: "chaos",
      contributes: [
        Menu.contribute({
          component: () => {
            throw new Error("boom")
          },
        }),
      ],
    })

    const { unmount } = render(
      <PluginProvider
        plugins={[plugin]}
        renderFailed={({ reset }) => {
          retry = reset
          return <li>failed</li>
        }}
      >
        <ul>
          <Menu.Host />
        </ul>
      </PluginProvider>,
    )

    unmount()

    // A fallback can hand its reset to anything — a toast, a retry queue — so
    // one that outlives the host must be a no-op rather than a crash.
    expect(() => act(() => retry?.())).not.toThrow()
    expect(items()).toEqual([])
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
    // Warned about, not repaired: both contributions still render, and React
    // says out loud what the warning is about — one key, two children.
    expect(items()).toEqual(["a", "b"])
    expect(errors.join("\n")).toMatch(/same key/i)
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

  it("skips the duplicate id check when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.resetModules()

    const errors: string[] = []
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "))
    })

    // A fresh module graph, because the check is decided once, at import.
    const { PluginProvider: Released } = await import("./provider")
    const { defineSlot: defineReleasedSlot } = await import("./slot")

    const Menu = defineReleasedSlot("identity-production")
    const make = (label: string) => ({
      id: "same",
      contributes: [Menu.contribute({ component: () => <li>{label}</li> })],
    })

    render(
      <Released plugins={[make("a"), make("b")]}>
        <ul>
          <Menu.Host />
        </ul>
      </Released>,
    )

    // The scan is a development aid, so a shipped build pays nothing for it —
    // and React's own complaint about the colliding keys is still there.
    expect(errors.join("\n")).not.toContain("Duplicate plugin id")
    expect(errors.join("\n")).toMatch(/same key/i)
    expect(items()).toEqual(["a", "b"])
  })
})

describe("registry host props", () => {
  it("re-renders a contribution when the host's prop names change", () => {
    const Toolbar = defineSlot<{ before?: string; after?: string }>(
      "props-key-set",
    )
    const seen: string[][] = []

    const plugin = definePlugin({
      id: "watcher",
      contributes: [
        Toolbar.contribute({
          component: (props) => {
            seen.push(Object.keys(props))

            return <li>{Object.keys(props).join(",")}</li>
          },
        }),
      ],
    })

    function App({ done }: { done: boolean }) {
      return (
        <PluginProvider plugins={[plugin]}>
          <ul>
            {done ? (
              <Toolbar.Host after={undefined} />
            ) : (
              <Toolbar.Host before={undefined} />
            )}
          </ul>
        </PluginProvider>
      )
    }

    const { rerender } = render(<App done={false} />)
    rerender(<App done={true} />)

    // Both objects hold one key worth `undefined`. Holding the host's props
    // steady by value alone would have called them equal and left the
    // contribution rendering with the props it was given first.
    expect(seen).toEqual([["before"], ["after"]])
    expect(items()).toEqual(["after"])
  })

  it("holds a NaN prop steady and treats -0 as a change", () => {
    const Toolbar = defineSlot<{ v: number }>("props-identity")
    const seen: string[] = []

    const plugin = definePlugin({
      id: "watcher",
      contributes: [
        Toolbar.contribute({
          component: ({ v }) => {
            seen.push(Object.is(v, -0) ? "-0" : String(v))

            return <li>{String(v)}</li>
          },
        }),
      ],
    })

    function App({ v }: { v: number }) {
      return (
        <PluginProvider plugins={[plugin]}>
          <ul>
            <Toolbar.Host v={v} />
          </ul>
        </PluginProvider>
      )
    }

    const { rerender } = render(<App v={Number.NaN} />)
    rerender(<App v={Number.NaN} />)
    rerender(<App v={0} />)
    rerender(<App v={-0} />)

    // `Object.is`, not `===`: a NaN prop that read as changed on every render
    // would re-render the contribution forever, and `-0` is a real change that
    // `==` would have hidden.
    expect(seen).toEqual(["NaN", "0", "-0"])
  })

  it("holds the host's props steady through StrictMode's double render", () => {
    const Toolbar = defineSlot<{ zoom: number }>("props-strict")
    let renders = 0

    const plugin = definePlugin({
      id: "watcher",
      contributes: [
        Toolbar.contribute({
          component: () => {
            renders++

            return <li>item</li>
          },
        }),
      ],
    })

    function App({ tick }: { tick: number }) {
      return (
        <React.StrictMode>
          <PluginProvider plugins={[plugin]}>
            <p>{tick}</p>
            <ul>
              <Toolbar.Host zoom={1} />
            </ul>
          </PluginProvider>
        </React.StrictMode>
      )
    }

    const { rerender } = render(<App tick={0} />)
    const afterMount = renders

    rerender(<App tick={1} />)

    // The props a host hands out are written to a ref during render, and
    // StrictMode renders twice and keeps the second pass. The double mount is
    // the baseline; the update on an unchanged host is the assertion — a ref
    // the second pass had replaced would make the contribution render again.
    expect(afterMount).toBe(2)
    expect(renders).toBe(2)
    expect(items()).toEqual(["item"])
  })

  it("never forwards the host's own children to a contribution", () => {
    const Toolbar = defineSlot<{ label: string }>("props-children")

    const plugin = definePlugin({
      id: "watcher",
      contributes: [
        Toolbar.contribute({
          component: (props) => <li>{Object.keys(props).join(",")}</li>,
        }),
      ],
    })

    render(
      <PluginProvider plugins={[plugin]}>
        <ul>
          <Toolbar.Host label="x">
            <li>placeholder</li>
          </Toolbar.Host>
        </ul>
      </PluginProvider>,
    )

    // `children` is the host's placeholder, not part of the slot's props, so a
    // contribution can spread what it is given onto a DOM node.
    expect(items()).toEqual(["label"])
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

  it("keeps every entry when a NaN order reaches both channels", () => {
    const Menu = defineSlot("channels-nonfinite")

    const plugin = definePlugin({
      id: "declared",
      contributes: [
        Menu.contribute({
          order: Number.NaN,
          component: () => <li>declared nan</li>,
        }),
        Menu.contribute({ order: 0, component: () => <li>declared 0</li> }),
      ],
    })

    render(
      <PluginProvider plugins={[plugin]}>
        <ul>
          <Menu.Host />
        </ul>
        <Menu.Fill order={Number.NaN}>
          <li>runtime nan</li>
        </Menu.Fill>
        <Menu.Fill order={1}>
          <li>runtime 1</li>
        </Menu.Fill>
      </PluginProvider>,
    )

    // Merging the two channels sorts them together, and a NaN makes that sort's
    // own result arbitrary. The promise is only that nothing is lost or
    // duplicated on the way through — a dropped feature would be the real bug.
    expect(items().sort()).toEqual([
      "declared 0",
      "declared nan",
      "runtime 1",
      "runtime nan",
    ])
  })

  it("keys a fill by its registration, not by its child's own key", () => {
    const errors: string[] = []
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "))
    })

    const Menu = defineSlot("channels-child-keys")

    // Two independent features can easily pick the same key for their own
    // element; the host stamps its own over it, so they cannot collide.
    render(
      <PluginProvider plugins={[]}>
        <ul>
          <Menu.Host />
        </ul>
        <Menu.Fill>
          <li key="row">one</li>
        </Menu.Fill>
        <Menu.Fill>
          <li key="row">two</li>
        </Menu.Fill>
      </PluginProvider>,
    )

    expect(items()).toEqual(["one", "two"])
    expect(errors.join("\n")).not.toMatch(/same key/i)
  })

  it("settles when a fill contributes another fill to the same slot", () => {
    const Menu = defineSlot("channels-reentrant")

    function Nested() {
      return (
        <li>
          outer
          <Menu.Fill order={5}>
            <li>inner</li>
          </Menu.Fill>
        </li>
      )
    }

    // The host renders the outer fill, which registers a second one from
    // inside the host's own subtree: one extra commit, and then a fixed point.
    render(
      <PluginProvider plugins={[]}>
        <ul>
          <Menu.Host />
        </ul>
        <Menu.Fill order={0}>
          <Nested />
        </Menu.Fill>
      </PluginProvider>,
    )

    expect(items()).toEqual(["outer", "inner"])
  })

  it("keeps a suspending fill from hiding its host and unregistering itself", async () => {
    const Menu = defineSlot("channels-suspending-fill")
    let resolved = false
    let release!: () => void
    let attempts = 0

    const pending = new Promise<void>((resolve) => {
      release = () => {
        resolved = true
        resolve()
      }
    })

    function Slow() {
      attempts++

      // If the host's outer boundary catches this promise, hiding it also
      // unmounts the Fill that registered Slow. The resulting delete/set loop
      // is synchronous, so cap it to make a regression fail instead of hanging
      // the whole test process.
      if (attempts > 20) {
        throw new Error("A suspending fill kept unregistering itself")
      }

      if (!resolved) {
        throw pending
      }

      return <li>slow</li>
    }

    render(
      <PluginProvider plugins={[]}>
        <React.Suspense fallback={<p>whole host is loading</p>}>
          <ul>
            <Menu.Host>
              <li>placeholder</li>
            </Menu.Host>
          </ul>
          <Menu.Fill>
            <Slow />
          </Menu.Fill>
          <Menu.Fill>
            <li>eager</li>
          </Menu.Fill>
        </React.Suspense>
      </PluginProvider>,
    )

    // The host stays mounted and useful while only the slow fill is pending.
    expect(screen.queryByText("whole host is loading")).toBeNull()
    expect(items()).toEqual(["eager"])
    expect(attempts).toBeLessThan(20)

    await act(async () => release())

    expect(items()).toEqual(["slow", "eager"])
  })

  it("fails fast when a fill is mounted inside its own host's placeholder", () => {
    silenceConsole()
    collectRecoveries()

    const Menu = defineSlot("channels-placeholder-fill")

    // The placeholder renders while nothing is contributed, so a fill living
    // in it removes the very thing that mounted it. React's own update-depth
    // limit is what stops it — the point is that it stops, loudly, instead of
    // flickering forever or settling into a wrong answer.
    expect(() =>
      render(
        <PluginProvider plugins={[]}>
          <ul>
            <Menu.Host>
              <Menu.Fill>
                <li>from the placeholder</li>
              </Menu.Fill>
            </Menu.Host>
          </ul>
        </PluginProvider>,
      ),
    ).toThrow(/update depth|too many re-?renders/i)
  })

  it("reaches a host mounted in another React root", () => {
    const Menu = defineSlot("channels-cross-root")

    const hostRoot = document.createElement("div")
    const fillRoot = document.createElement("div")
    document.body.append(hostRoot, fillRoot)

    render(
      <PluginProvider plugins={[]}>
        <ul>
          <Menu.Host>
            <li>placeholder</li>
          </Menu.Host>
        </ul>
      </PluginProvider>,
      { container: hostRoot },
    )

    expect(items()).toEqual(["placeholder"])

    // The runtime store is one module-level object, so a slot name is shared by
    // every React root using this loaded copy of the package — a widget mounted
    // beside an application addresses the same slot.
    render(
      <PluginProvider plugins={[]}>
        <Menu.Fill>
          <li>from the other root</li>
        </Menu.Fill>
      </PluginProvider>,
      { container: fillRoot },
    )

    expect(items()).toEqual(["from the other root"])
  })

  it("hosts one slot inside another slot's contribution", () => {
    const Panel = defineSlot("channels-nested-outer")
    const Actions = defineSlot<{ scope: string }>("channels-nested-inner")

    function PanelBody() {
      return (
        <li>
          <span data-testid="panel-owner">{usePluginId()}</span>
          <ul>
            <Actions.Host scope="row" />
          </ul>
        </li>
      )
    }

    function Action({ scope }: { scope: string }) {
      return (
        <li>
          <span data-testid="action">{`${scope} by ${usePluginId()}`}</span>
        </li>
      )
    }

    const shell = definePlugin({
      id: "shell",
      contributes: [Panel.contribute({ component: PanelBody })],
    })

    const feature = definePlugin({
      id: "feature",
      contributes: [Actions.contribute({ component: Action })],
    })

    render(
      <PluginProvider plugins={[shell, feature]}>
        <ul>
          <Panel.Host />
        </ul>
      </PluginProvider>,
    )

    // A contribution is an ordinary component, so it can open a slot of its
    // own — and both the props and the plugin id follow the contribution that
    // is rendering, not the one that made room for it.
    expect(screen.getByTestId("panel-owner").textContent).toBe("shell")
    expect(screen.getByTestId("action").textContent).toBe("row by feature")
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

  it("renders a contribution that arrived without an order", () => {
    const Menu = defineSlot("contract-malformed")

    // Because a contribution is data, a manifest can cross a boundary the
    // library did not build it on: another build of the package, a plugin
    // published on its own, a list rebuilt from JSON. The host reads fields it
    // did not create, so a missing one must cost that entry nothing.
    const handmade = {
      slot: "contract-malformed",
      component: () => <li>handmade</li>,
    } as unknown as Contribution

    const plugin = definePlugin({
      id: "external",
      contributes: [
        handmade,
        Menu.contribute({ order: 0, component: () => <li>declared</li> }),
      ],
    })

    render(
      <PluginProvider plugins={[plugin]}>
        <ul>
          <Menu.Host />
        </ul>
      </PluginProvider>,
    )

    // `undefined - 0` is NaN, which the comparator's `||` chain reads as a tie,
    // so the entry keeps its declaration position instead of disappearing.
    expect(items()).toEqual(["handmade", "declared"])
  })
})
