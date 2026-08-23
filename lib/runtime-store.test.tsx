import { cleanup, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { defineSlot, PluginProvider } from "./create-slot"
import { trackedSlots } from "./runtime"

function items(): string[] {
  return Array.from(document.querySelectorAll("li")).map(
    (li) => li.textContent?.trim() ?? "",
  )
}

afterEach(() => {
  // Explicit, so the assertion below never depends on where the library's own
  // auto-cleanup sits in the hook order.
  cleanup()
  vi.restoreAllMocks()

  // The store is one module-level object shared by this whole file: a test
  // that leaves anything behind would be indistinguishable from a leak in the
  // next one.
  expect(trackedSlots()).toEqual({ entries: 0, snapshots: 0, listeners: 0 })
})

describe("runtime store", () => {
  it("holds nothing for a slot once its fills and hosts are gone", () => {
    const Menu = defineSlot("store-release")

    function App({ mounted }: { mounted: boolean }) {
      return (
        <PluginProvider plugins={[]}>
          {mounted && (
            <>
              <ul>
                <Menu.Host />
              </ul>
              <Menu.Fill>
                <li>one</li>
              </Menu.Fill>
              <Menu.Fill order={1}>
                <li>two</li>
              </Menu.Fill>
            </>
          )}
        </PluginProvider>
      )
    }

    const { rerender } = render(<App mounted={true} />)
    expect(items()).toEqual(["one", "two"])
    expect(trackedSlots()).toEqual({
      entries: 1,
      snapshots: 1,
      listeners: 1,
    })

    // Slot names can be generated per row, so an idle slot that kept a bucket,
    // a cached snapshot and a listener set would grow the store without bound.
    rerender(<App mounted={false} />)
    expect(trackedSlots()).toEqual({ entries: 0, snapshots: 0, listeners: 0 })
  })

  it("comes back to life after the slot was released", () => {
    const Menu = defineSlot("store-revive")

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
              <li>fill</li>
            </Menu.Fill>
          )}
        </PluginProvider>
      )
    }

    // Dropping the bucket must not leave the slot deaf to the next fill.
    const { rerender, unmount } = render(<App mounted={true} />)
    expect(items()).toEqual(["fill"])

    rerender(<App mounted={false} />)
    expect(items()).toEqual(["placeholder"])

    rerender(<App mounted={true} />)
    expect(items()).toEqual(["fill"])

    unmount()
  })

  it("keeps the remaining host subscribed when another one unmounts", () => {
    const Menu = defineSlot("store-two-hosts")

    function App({ hosts, fill }: { hosts: number; fill: boolean }) {
      return (
        <PluginProvider plugins={[]}>
          {Array.from({ length: hosts }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
            <ul key={i} data-testid={`host-${i}`}>
              <Menu.Host />
            </ul>
          ))}
          {fill && (
            <Menu.Fill>
              <li>fill</li>
            </Menu.Fill>
          )}
        </PluginProvider>
      )
    }

    const { rerender, unmount } = render(<App hosts={2} fill={false} />)

    // Both hosts share one listener set; the first to leave must not take the
    // set — and so the other host's subscription — with it.
    rerender(<App hosts={1} fill={false} />)
    rerender(<App hosts={1} fill={true} />)

    expect(screen.getByTestId("host-0").textContent).toBe("fill")

    unmount()
  })

  it("survives repeated mount and unmount cycles without accumulating", () => {
    const Menu = defineSlot("store-churn")

    function App({ fills }: { fills: number }) {
      return (
        <PluginProvider plugins={[]}>
          <ul>
            <Menu.Host />
          </ul>
          {Array.from({ length: fills }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
            <Menu.Fill key={i} order={fills - i}>
              <li>{`fill ${i}`}</li>
            </Menu.Fill>
          ))}
        </PluginProvider>
      )
    }

    const { rerender, unmount } = render(<App fills={0} />)

    for (const fills of [3, 0, 5, 1, 0, 4]) {
      rerender(<App fills={fills} />)

      expect(items()).toEqual(
        Array.from({ length: fills }, (_, i) => `fill ${fills - 1 - i}`),
      )
    }

    unmount()
  })

  it("serves the same snapshot back while nothing changes", () => {
    const warnings: string[] = []
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(" "))
    })

    const Menu = defineSlot("store-snapshot")

    function App() {
      const [tick, bump] = React.useReducer((x: number) => x + 1, 0)

      return (
        <PluginProvider plugins={[]}>
          <button type="button" onClick={bump}>
            tick {tick}
          </button>
          <ul>
            <Menu.Host />
          </ul>
          <Menu.Fill>
            <li>fill</li>
          </Menu.Fill>
        </PluginProvider>
      )
    }

    const { unmount } = render(<App />)

    // A snapshot rebuilt on every read is what makes `useSyncExternalStore`
    // warn and then spin; re-rendering the host repeatedly would surface it.
    for (let i = 0; i < 5; i++) {
      screen.getByRole("button").click()
    }

    expect(items()).toEqual(["fill"])
    expect(warnings.join("\n")).not.toMatch(/getSnapshot|infinite loop/i)

    unmount()
  })
})
