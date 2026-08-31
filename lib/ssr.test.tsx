import { render } from "@testing-library/react"
import type React from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { collectRecoveries, stopCollectingRecoveries } from "../test/recoveries"
import { trackedFills } from "./facade/create-slot"
import {
  createSlot,
  definePlugin,
  defineSlot,
  type Resolution,
  resolvePlugins,
  SlotHost,
  SlotProvider,
  useContribution,
} from "./index"

const NavMenu = defineSlot<{ current: string }>("nav-menu")

function PricingNavItem({ current }: { current: string }) {
  return (
    <li>
      pricing in {useContribution().pluginId}{" "}
      {current === "/pricing" ? "(current)" : ""}
    </li>
  )
}

const pricing = definePlugin({
  id: "pricing",
  contributes: [
    NavMenu.contribute("nav-item", { order: 0, component: PricingNavItem }),
  ],
})

const reports = definePlugin({
  id: "reports",
  contributes: [
    NavMenu.contribute("nav-item", {
      order: 10,
      component: () => <li>reports</li>,
    }),
  ],
})

const broken = definePlugin({
  id: "broken",
  contributes: [
    NavMenu.contribute("nav-item", {
      order: 0,
      component: () => {
        throw new Error("boom")
      },
    }),
  ],
})

const Failed = ({ pluginId }: { pluginId: string }) => (
  <li>{pluginId} failed</li>
)

function textOf(html: string): string {
  const host = document.createElement("div")
  host.innerHTML = html
  return host.textContent ?? ""
}

function tree(resolution: Resolution) {
  return (
    <SlotProvider resolution={resolution}>
      <ul>
        <SlotHost slot={NavMenu} props={{ current: "/pricing" }} />
      </ul>
    </SlotProvider>
  )
}

function hydrateInto(html: string, ui: React.ReactElement) {
  const container = document.createElement("div")
  container.innerHTML = html
  document.body.appendChild(container)

  return render(ui, { container, hydrate: true })
}

/**
 * Everything React says about a render.
 *
 * It uses two channels, and a version bump moves messages between them: dev
 * warnings go to `console.error` as a format string plus arguments, so every
 * argument counts, while a recoverable error — a hydration mismatch, or a
 * Suspense boundary the server could not finish — goes to `reportError`,
 * which jsdom turns into a window error event.
 */
function collectReports() {
  const reports: string[] = []

  vi.spyOn(console, "error").mockImplementation((...args) =>
    reports.push(args.map(String).join(" ")),
  )

  collectRecoveries(reports)

  return {
    all: reports,
    get text() {
      return reports.join("\n")
    },
  }
}

afterEach(() => {
  stopCollectingRecoveries()
  vi.restoreAllMocks()
})

describe("registry SSR", () => {
  it("renders contributions into the server HTML, in order", () => {
    const html = renderToString(tree(resolvePlugins([pricing, reports])))
    const text = textOf(html)

    // useContribution() and the host's props both work during a server render.
    expect(text).toContain("pricing in pricing (current)")
    expect(text.indexOf("pricing in")).toBeLessThan(text.indexOf("reports"))
  })

  it("hydrates the server HTML without a mismatch", () => {
    // The contract asks for the same INPUTS, not the same object: two
    // resolutions of one plugin list are deep-equal, and that is enough.
    const html = renderToString(tree(resolvePlugins([pricing, reports])))
    const reported = collectReports()

    hydrateInto(html, tree(resolvePlugins([pricing, reports])))

    expect(reported.all).toEqual([])
  })

  it("mismatches when the client is given a different plugin list", () => {
    const html = renderToString(tree(resolvePlugins([pricing, reports])))
    const reported = collectReports()

    // The library's whole SSR contract in one negative test.
    hydrateInto(html, tree(resolvePlugins([pricing])))

    expect(reported.text).toMatch(/server|hydrat/i)
  })

  it("mismatches when the client is given the same plugins in another order", () => {
    const sameOrder = definePlugin({
      id: "reports",
      contributes: [
        NavMenu.contribute("nav-item", {
          order: 0,
          component: () => <li>reports</li>,
        }),
      ],
    })

    const html = renderToString(tree(resolvePlugins([pricing, sameOrder])))
    const reported = collectReports()

    // Equal ranks are broken by list position, so reordering the list is a
    // different markup — the sneakier half of "the same list, in the same
    // order".
    hydrateInto(html, tree(resolvePlugins([sameOrder, pricing])))

    expect(reported.text).toMatch(/server|hydrat/i)
  })

  it("leaves a façade fill out of the server HTML, then adds it on the client", () => {
    const Menu = createSlot()

    const ui = (
      <>
        <ul>
          <Menu.Host>
            <li>placeholder</li>
          </Menu.Host>
        </ul>
        <Menu>
          <li>runtime</li>
        </Menu>
      </>
    )

    const reported = collectReports()
    const html = renderToString(ui)

    // Registering from a layout effect is what a server render complains
    // about, and jsdom is exactly where the library has to choose: `window`
    // exists here, and `renderToString` still has to pass in silence.
    expect(reported.all).toEqual([])

    // The runtime channel is invisible to a server render by construction, so
    // the host ships its placeholder instead.
    expect(textOf(html)).toContain("placeholder")
    expect(textOf(html)).not.toContain("runtime")

    const { container, unmount } = hydrateInto(html, ui)

    // Hydration matches what the server sent; the fill arrives in the effect
    // that follows it.
    expect(
      reported.all.filter((report) => /hydrat|server/i.test(report)),
    ).toEqual([])
    expect(
      Array.from(container.querySelectorAll("li")).map((li) => li.textContent),
    ).toEqual(["runtime"])

    unmount()

    expect(trackedFills(Menu)).toEqual({ entries: 0, listeners: 0 })
  })

  it("renders the same markup whatever the client has registered", () => {
    const Menu = createSlot()
    const first = renderToString(tree(resolvePlugins([pricing, reports])))

    // A live client tree, filling a façade store in between the two server
    // renders.
    render(
      <>
        <ul>
          <Menu.Host />
        </ul>
        <Menu>
          <li>client only</li>
        </Menu>
      </>,
    )

    const second = renderToString(tree(resolvePlugins([pricing, reports])))
    const sharedSlot = renderToString(
      <ul>
        <Menu.Host>
          <li>placeholder</li>
        </Menu.Host>
      </ul>,
    )

    // `getServerSnapshot` is empty by construction, so server markup is a
    // function of the resolution alone, byte for byte — even while a client
    // tree in the same process holds live fills.
    expect(second).toBe(first)
    expect(textOf(sharedSlot)).toBe("placeholder")
  })

  it("refuses a host outside the provider on the server too", () => {
    const Orphan = defineSlot("ssr-orphan")

    expect(() => renderToString(<SlotHost slot={Orphan} />)).toThrow(
      "[create-slot] 'SlotHost' rendered outside of 'SlotProvider'",
    )
  })

  it("isolates a failing contribution on the server too", () => {
    const resolution = resolvePlugins([broken, reports])

    const ui = (
      <SlotProvider resolution={resolution} Failed={Failed}>
        <ul>
          <SlotHost slot={NavMenu} props={{ current: "/" }} />
        </ul>
      </SlotProvider>
    )

    const html = renderToString(ui)

    // `getDerivedStateFromError` does not run on the server, but the Suspense
    // boundary around each contribution does its job: React marks just that
    // boundary for a client render (<!--$!-->) and keeps the rest of the HTML.
    expect(html).toContain("<!--$!-->")
    expect(textOf(html)).toContain("reports")

    const reported = collectReports()

    hydrateInto(html, ui)

    // On the client the same boundary re-renders, the class boundary catches,
    // and the Failed component finally appears.
    expect(
      Array.from(document.querySelectorAll("li")).map((li) => li.textContent),
    ).toEqual(["broken failed", "reports"])
    expect(reported.text).toContain("boom")
  })
})
