import { act, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  collectRecoveries,
  stopCollectingRecoveries,
} from "../../test/recoveries"
import { createSlot, trackedFills } from "./create-slot"

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
})

describe("per-factory store", () => {
  it("holds nothing once its fills and hosts are gone", () => {
    const Menu = createSlot()

    function App({ mounted }: { mounted: boolean }) {
      return mounted ? (
        <>
          <ul>
            <Menu.Host />
          </ul>
          <Menu>
            <li>one</li>
          </Menu>
          <Menu order={1}>
            <li>two</li>
          </Menu>
        </>
      ) : null
    }

    const { rerender } = render(<App mounted={true} />)

    expect(items()).toEqual(["one", "two"])
    expect(trackedFills(Menu)).toEqual({ entries: 2, listeners: 1 })

    rerender(<App mounted={false} />)

    expect(trackedFills(Menu)).toEqual({ entries: 0, listeners: 0 })
  })

  it("comes back to life after everything unmounted", () => {
    const Menu = createSlot()

    function App({ mounted }: { mounted: boolean }) {
      return (
        <>
          <ul>
            <Menu.Host>
              <li>placeholder</li>
            </Menu.Host>
          </ul>
          {mounted && (
            <Menu>
              <li>fill</li>
            </Menu>
          )}
        </>
      )
    }

    const { rerender } = render(<App mounted={true} />)

    expect(items()).toEqual(["fill"])

    rerender(<App mounted={false} />)

    expect(items()).toEqual(["placeholder"])

    rerender(<App mounted={true} />)

    expect(items()).toEqual(["fill"])
  })

  it("keeps the remaining host subscribed when another one unmounts", () => {
    const Menu = createSlot()

    function App({ hosts, filled }: { hosts: number; filled: boolean }) {
      return (
        <>
          {Array.from({ length: hosts }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
            <ul key={index} data-testid={`host-${index}`}>
              <Menu.Host />
            </ul>
          ))}
          {filled && (
            <Menu>
              <li>fill</li>
            </Menu>
          )}
        </>
      )
    }

    const { rerender } = render(<App hosts={2} filled={false} />)

    rerender(<App hosts={1} filled={true} />)

    expect(screen.getByTestId("host-0").textContent).toBe("fill")
    expect(trackedFills(Menu)).toEqual({ entries: 1, listeners: 1 })
  })

  it("isolates two factories from each other completely", () => {
    // v3 shared one name-keyed module store across the package; the factory
    // closure is the new contract: no name, no sharing, no way to collide.
    const A = createSlot()
    const B = createSlot()

    render(
      <>
        <ul data-testid="a">
          <A.Host>
            <li>a empty</li>
          </A.Host>
        </ul>
        <ul data-testid="b">
          <B.Host>
            <li>b empty</li>
          </B.Host>
        </ul>
        <A>
          <li>from a</li>
        </A>
      </>,
    )

    expect(screen.getByTestId("a").textContent).toBe("from a")
    expect(screen.getByTestId("b").textContent).toBe("b empty")
  })

  it("reaches a host mounted in another React root", () => {
    const Menu = createSlot()

    const hostRoot = document.createElement("div")
    const fillRoot = document.createElement("div")

    document.body.append(hostRoot, fillRoot)

    render(
      <ul>
        <Menu.Host>
          <li>placeholder</li>
        </Menu.Host>
      </ul>,
      { container: hostRoot },
    )

    expect(items()).toEqual(["placeholder"])

    // The factory object is the address: any root that imports it fills the
    // same hosts — a widget mounted beside an application still lands.
    render(
      <Menu>
        <li>from the other root</li>
      </Menu>,
      { container: fillRoot },
    )

    expect(items()).toEqual(["from the other root"])
  })
})

describe("fill identity", () => {
  it("keys a fill by its registration, not by its child's own key", () => {
    const Menu = createSlot()

    render(
      <>
        <ul>
          <Menu.Host />
        </ul>
        <Menu>
          <li key="same">first</li>
        </Menu>
        <Menu>
          <li key="same">second</li>
        </Menu>
      </>,
    )

    // Two fills whose children carry one author-written key must not collide.
    expect(items()).toEqual(["first", "second"])
  })

  it("reconciles changed content instead of remounting it", () => {
    const Menu = createSlot()
    let mounts = 0

    function Tracker({ label }: { label: string }) {
      React.useEffect(() => {
        mounts++
      }, [])

      return <li>{label}</li>
    }

    function App({ label }: { label: string }) {
      return (
        <>
          <ul>
            <Menu.Host />
          </ul>
          <Menu>
            <Tracker label={label} />
          </Menu>
        </>
      )
    }

    const { rerender } = render(<App label="one" />)

    rerender(<App label="two" />)

    expect(items()).toEqual(["two"])
    expect(mounts).toBe(1)
  })
})

describe("suspension and failure", () => {
  it("keeps a suspending fill from hiding its host and unregistering itself", async () => {
    const Menu = createSlot()
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
      // unmounts the fill that registered Slow. The resulting delete/set loop
      // is synchronous, so cap it to make a regression fail instead of
      // hanging the whole test process.
      if (attempts > 20) {
        throw new Error("A suspending fill kept unregistering itself")
      }

      if (!resolved) {
        throw pending
      }

      return <li>slow</li>
    }

    const { unmount } = render(
      <React.Suspense fallback={<p>whole host is loading</p>}>
        <ul>
          <Menu.Host>
            <li>placeholder</li>
          </Menu.Host>
        </ul>
        <Menu>
          <Slow />
        </Menu>
        <Menu>
          <li>eager</li>
        </Menu>
      </React.Suspense>,
    )

    // The host stays mounted and useful while only the slow fill is pending.
    expect(screen.queryByText("whole host is loading")).toBeNull()
    expect(items()).toEqual(["eager"])
    expect(attempts).toBeLessThan(20)

    await act(async () => release())

    expect(items()).toEqual(["slow", "eager"])

    // The teardown after a suspension is where the last leak bug lived
    // (commit 236f19f); the store must come out empty.
    unmount()

    expect(trackedFills(Menu)).toEqual({ entries: 0, listeners: 0 })
  })

  it("fails fast when a fill is mounted inside its own host's placeholder", () => {
    silenceConsole()
    collectRecoveries()

    const Menu = createSlot()

    // The placeholder renders while nothing is contributed, so a fill living
    // in it removes the very thing that mounted it. React's own update-depth
    // limit is what stops it — the point is that it stops, loudly, instead of
    // flickering forever or settling into a wrong answer.
    expect(() =>
      render(
        <ul>
          <Menu.Host>
            <Menu>
              <li>from the placeholder</li>
            </Menu>
          </Menu.Host>
        </ul>,
      ),
    ).toThrow(/update depth|too many re-?renders/i)
  })

  it("settles when a fill contributes another fill to the same slot", () => {
    const Menu = createSlot()

    function Nested() {
      return (
        <li>
          outer
          <Menu order={1}>
            <li>inner</li>
          </Menu>
        </li>
      )
    }

    // The host renders the outer fill, which registers a second one from
    // inside the host's own subtree: one extra commit, then a fixed point.
    render(
      <>
        <ul>
          <Menu.Host />
        </ul>
        <Menu order={0}>
          <Nested />
        </Menu>
      </>,
    )

    expect(items()).toEqual(["outer", "inner"])
  })

  it("does not isolate a fill that throws", () => {
    silenceConsole()

    const Menu = createSlot()

    function Boom(): never {
      throw new Error("fill boom")
    }

    // A fill is the application's own code in the application's own tree; the
    // registry invents no error boundary and no plugin identity for it.
    expect(() =>
      render(
        <>
          <ul>
            <Menu.Host />
          </ul>
          <Menu>
            <Boom />
          </Menu>
        </>,
      ),
    ).toThrow("fill boom")
  })
})
