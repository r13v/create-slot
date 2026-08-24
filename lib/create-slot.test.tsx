import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createSlot } from "./create-slot"

function items(container: HTMLElement = document.body): string[] {
  return Array.from(container.querySelectorAll("li")).map(
    (li) => li.textContent?.trim() ?? "",
  )
}

function silenceConsole() {
  vi.spyOn(console, "error").mockImplementation(() => {})
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createSlot ordering", () => {
  it("shows the host's children until a fill arrives, then only the fills", () => {
    const Menu = createSlot<{ n: number }>()

    function App({ showA, showB }: { showA: boolean; showB: boolean }) {
      return (
        <>
          <ul>
            <Menu.Host n={0}>
              <li>placeholder</li>
            </Menu.Host>
          </ul>
          {/* Declared last but ordered first: tree order must not decide. */}
          {showB && (
            <Menu order={10}>
              <li>b</li>
            </Menu>
          )}
          {showA && (
            <Menu order={0}>
              <li>a</li>
            </Menu>
          )}
        </>
      )
    }

    const { rerender } = render(<App showA={false} showB={false} />)
    expect(items()).toEqual(["placeholder"])

    rerender(<App showA={true} showB={true} />)
    expect(items()).toEqual(["a", "b"])

    rerender(<App showA={false} showB={true} />)
    expect(items()).toEqual(["b"])

    rerender(<App showA={false} showB={false} />)
    expect(items()).toEqual(["placeholder"])
  })

  it("keeps colliding orders apart by mount sequence, even after a remount", () => {
    const Menu = createSlot()

    function App({ showA }: { showA: boolean }) {
      return (
        <>
          <ul>
            <Menu.Host>
              <li>placeholder</li>
            </Menu.Host>
          </ul>
          {showA && (
            <Menu order={0}>
              <li>a</li>
            </Menu>
          )}
          <Menu order={0}>
            <li>b</li>
          </Menu>
        </>
      )
    }

    // Before 3.0 a shared `order` meant the later fill replaced the earlier.
    const { rerender } = render(<App showA={true} />)
    expect(items()).toEqual(["a", "b"])

    rerender(<App showA={false} />)
    expect(items()).toEqual(["b"])

    // The sequence never rewinds, so a remounted fill re-enters at the back of
    // its own rank rather than reclaiming its old place.
    rerender(<App showA={true} />)
    expect(items()).toEqual(["b", "a"])
  })

  it("ranks negative, fractional and infinite orders", () => {
    const Menu = createSlot()
    const orders = [
      Number.POSITIVE_INFINITY,
      -1.5,
      0,
      Number.NEGATIVE_INFINITY,
      0.5,
      -2,
    ]

    render(
      <>
        <ul>
          <Menu.Host>
            <li>placeholder</li>
          </Menu.Host>
        </ul>
        {orders.map((order) => (
          <Menu key={order} order={order}>
            <li>{String(order)}</li>
          </Menu>
        ))}
      </>,
    )

    expect(items()).toEqual(
      [...orders].sort((a, b) => a - b).map((order) => String(order)),
    )
  })

  it("keeps every fill when one is given a NaN order", () => {
    const Menu = createSlot()

    render(
      <>
        <ul>
          <Menu.Host>
            <li>placeholder</li>
          </Menu.Host>
        </ul>
        <Menu order={0}>
          <li>zero</li>
        </Menu>
        <Menu order={Number.NaN}>
          <li>nan</li>
        </Menu>
        <Menu order={1}>
          <li>one</li>
        </Menu>
      </>,
    )

    // A NaN comparison makes the sort's own result arbitrary, so the promise is
    // only that garbage in does not lose or duplicate a contribution.
    expect(items().sort()).toEqual(["nan", "one", "zero"])
  })

  it("orders and then releases two hundred fills", () => {
    const Menu = createSlot()
    // Interleaved so mount order contradicts `order` almost everywhere.
    const orders = Array.from({ length: 200 }, (_, i) => (i * 37) % 200)

    function App({ mounted }: { mounted: boolean }) {
      return (
        <>
          <ul>
            <Menu.Host>
              <li>placeholder</li>
            </Menu.Host>
          </ul>
          {mounted &&
            orders.map((order) => (
              <Menu key={order} order={order}>
                <li>{String(order)}</li>
              </Menu>
            ))}
        </>
      )
    }

    const { rerender } = render(<App mounted={true} />)
    expect(items()).toEqual(
      [...orders].sort((a, b) => a - b).map((order) => String(order)),
    )

    rerender(<App mounted={false} />)
    expect(items()).toEqual(["placeholder"])
  })
})

describe("createSlot hosts", () => {
  it("renders the same fills into every mounted host", () => {
    const Menu = createSlot<{ n: number }>()

    const { container } = render(
      <>
        <ul data-testid="one">
          <Menu.Host n={0}>
            <li>placeholder one</li>
          </Menu.Host>
        </ul>
        <ul data-testid="two">
          <Menu.Host n={1}>
            <li>placeholder two</li>
          </Menu.Host>
        </ul>
        <Menu order={0}>
          <li>shared</li>
        </Menu>
      </>,
    )

    expect(items(within(container).getByTestId("one"))).toEqual(["shared"])
    expect(items(within(container).getByTestId("two"))).toEqual(["shared"])
  })

  it("reaches a host that mounts after the fill, and one declared after it", () => {
    const Menu = createSlot()

    function App({ showHost }: { showHost: boolean }) {
      return (
        <>
          {/* The fill is committed before this host exists in either case. */}
          <Menu order={0}>
            <li>fill</li>
          </Menu>
          {showHost && (
            <ul>
              <Menu.Host>
                <li>placeholder</li>
              </Menu.Host>
            </ul>
          )}
        </>
      )
    }

    // Same commit: the host subscribes after the fill's layout effect ran.
    const first = render(<App showHost={true} />)
    expect(items()).toEqual(["fill"])
    first.unmount()

    // Later commit: the host has to read what the store already holds.
    const second = render(<App showHost={false} />)
    expect(items()).toEqual([])

    second.rerender(<App showHost={true} />)
    expect(items()).toEqual(["fill"])
  })

  it("isolates two factories from each other", () => {
    const First = createSlot()
    const Second = createSlot()

    const { container } = render(
      <>
        <ul data-testid="first">
          <First.Host>
            <li>placeholder first</li>
          </First.Host>
        </ul>
        <ul data-testid="second">
          <Second.Host>
            <li>placeholder second</li>
          </Second.Host>
        </ul>
        <First order={0}>
          <li>into first</li>
        </First>
        <Second order={0}>
          <li>into second</li>
        </Second>
      </>,
    )

    expect(items(within(container).getByTestId("first"))).toEqual([
      "into first",
    ])
    expect(items(within(container).getByTestId("second"))).toEqual([
      "into second",
    ])
  })
})

describe("createSlot props", () => {
  it("hands host props to a fill and updates it without remounting", async () => {
    const user = userEvent.setup()
    const Menu = createSlot<{ n: number; inc: () => void }>()
    let mounts = 0

    function Counter() {
      React.useEffect(() => {
        mounts++
      }, [])

      const { n, inc } = Menu.useProps()

      return (
        <button type="button" onClick={inc}>
          n: {n}
        </button>
      )
    }

    function App() {
      const [n, inc] = React.useReducer((x: number) => x + 1, 0)

      return (
        <>
          <ul>
            <Menu.Host n={n} inc={inc}>
              <li>placeholder</li>
            </Menu.Host>
          </ul>
          <Menu order={0}>
            <li>
              <Counter />
            </li>
          </Menu>
        </>
      )
    }

    render(<App />)

    const button = screen.getByRole("button")
    expect(button).toHaveTextContent("n: 0")

    await user.click(button)
    await user.click(button)

    expect(button).toHaveTextContent("n: 2")
    expect(mounts).toBe(1)
  })

  it("returns null from useProps outside a host", () => {
    const Menu = createSlot<{ n: number }>()

    function Orphan() {
      // The façade's signature promises `Props`, which only holds inside a
      // host; anywhere else the underlying context default shows through.
      return <p>{String(Menu.useProps())}</p>
    }

    render(<Orphan />)

    expect(screen.getByText("null")).toBeInTheDocument()
  })
})

describe("createSlot identity", () => {
  it("reconciles changed fill content instead of remounting it", async () => {
    const user = userEvent.setup()
    const Menu = createSlot()
    let mounts = 0

    function Child({ label }: { label: string }) {
      React.useEffect(() => {
        mounts++
      }, [])

      return <li>{label}</li>
    }

    function App() {
      const [label, next] = React.useReducer(
        (x: string) => (x === "a" ? "b" : "a"),
        "a",
      )

      return (
        <>
          <button type="button" onClick={next}>
            toggle
          </button>
          <ul>
            <Menu.Host>
              <li>placeholder</li>
            </Menu.Host>
          </ul>
          <Menu order={0}>
            <Child label={label} />
          </Menu>
        </>
      )
    }

    render(<App />)
    expect(items()).toEqual(["a"])

    await user.click(screen.getByRole("button", { name: "toggle" }))

    expect(items()).toEqual(["b"])
    expect(mounts).toBe(1)
  })

  it("reads order once: a changed order neither moves nor remounts the fill", async () => {
    const user = userEvent.setup()
    const Menu = createSlot()
    let mounts = 0

    function Movable() {
      React.useEffect(() => {
        mounts++
      }, [])

      return <li>movable</li>
    }

    function App() {
      const [order, bump] = React.useReducer((x: number) => x + 100, 0)

      return (
        <>
          <button type="button" onClick={bump}>
            reorder
          </button>
          <ul>
            <Menu.Host>
              <li>placeholder</li>
            </Menu.Host>
          </ul>
          <Menu order={order}>
            <Movable />
          </Menu>
          <Menu order={5}>
            <li>anchor</li>
          </Menu>
        </>
      )
    }

    render(<App />)
    expect(items()).toEqual(["movable", "anchor"])

    await user.click(screen.getByRole("button", { name: "reorder" }))

    // Order 100 would sort behind the anchor had it been re-read.
    expect(items()).toEqual(["movable", "anchor"])
    expect(mounts).toBe(1)
  })

  it("registers a fill once under StrictMode's double mount", () => {
    const Menu = createSlot()

    function App({ mounted }: { mounted: boolean }) {
      return (
        <React.StrictMode>
          <ul>
            <Menu.Host>
              <li>placeholder</li>
            </Menu.Host>
          </ul>
          {mounted && (
            <Menu order={0}>
              <li>fill</li>
            </Menu>
          )}
        </React.StrictMode>
      )
    }

    // StrictMode mounts, tears down and remounts every effect. The teardown
    // must not outlive the second registration, nor duplicate it.
    const { rerender } = render(<App mounted={true} />)
    expect(items()).toEqual(["fill"])

    rerender(<App mounted={false} />)
    expect(items()).toEqual(["placeholder"])
  })
})

describe("createSlot misuse", () => {
  it("throws when a Slot renders without children", () => {
    silenceConsole()

    const Menu = createSlot()
    const Untyped = Menu as unknown as React.FC<{ order?: number }>

    expect(() => render(<Untyped order={0} />)).toThrow(
      "[create-slot] 'Slot' without children rendered",
    )
  })

  it("throws when a fill's child is not a single element", () => {
    silenceConsole()

    const Menu = createSlot()
    const Untyped = Menu as unknown as React.FC<{ children: unknown }>

    // `cloneElement` would otherwise mint an element with no type, and React
    // reports that as a missing export in a file the caller never wrote.
    for (const child of [
      "text",
      42,
      [<li key="a">a</li>, <li key="b">b</li>],
    ]) {
      expect(() => render(<Untyped>{child}</Untyped>)).toThrow(
        "[create-slot] A fill expects a single React element as its child",
      )
    }
  })
})
