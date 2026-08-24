import { render } from "@testing-library/react"
import type React from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  definePlugin,
  defineSlot,
  PluginProvider,
  usePluginId,
} from "./create-slot"

const NavMenu = defineSlot<{ current: string }>("nav-menu")

function PricingNavItem({ current }: { current: string }) {
  return (
    <li>
      pricing in {usePluginId()} {current === "/pricing" ? "(current)" : ""}
    </li>
  )
}

const pricing = definePlugin({
  id: "pricing",
  contributes: [NavMenu.contribute({ order: 0, component: PricingNavItem })],
})

const reports = definePlugin({
  id: "reports",
  contributes: [
    NavMenu.contribute({ order: 10, component: () => <li>reports</li> }),
  ],
})

const broken = definePlugin({
  id: "broken",
  contributes: [
    NavMenu.contribute({
      order: 0,
      component: () => {
        throw new Error("boom")
      },
    }),
  ],
})

const renderFailed = ({ pluginId }: { pluginId: string }) => (
  <li>{pluginId} failed</li>
)

function textOf(html: string): string {
  const host = document.createElement("div")
  host.innerHTML = html
  return host.textContent ?? ""
}

function App({ current }: { current: string }) {
  return (
    <ul>
      <NavMenu.Host current={current} />
    </ul>
  )
}

function tree(plugins: Parameters<typeof PluginProvider>[0]["plugins"]) {
  return (
    <PluginProvider plugins={plugins}>
      <App current="/pricing" />
    </PluginProvider>
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
 * Suspense boundary the server could not finish — goes to `reportError`, which
 * jsdom turns into a window error event.
 */
function collectReports() {
  const reports: string[] = []

  vi.spyOn(console, "error").mockImplementation((...args) =>
    reports.push(args.map(String).join(" ")),
  )

  const onError = (event: ErrorEvent) => {
    // Otherwise the test runner counts it as an unhandled error.
    event.preventDefault()
    reports.push(String(event.error ?? event.message))
  }

  window.addEventListener("error", onError)
  stopCollecting = () => window.removeEventListener("error", onError)

  return {
    all: reports,
    get text() {
      return reports.join("\n")
    },
  }
}

let stopCollecting: (() => void) | null = null

afterEach(() => {
  stopCollecting?.()
  stopCollecting = null
  vi.restoreAllMocks()
})

describe("registry SSR", () => {
  it("renders contributions into the server HTML, in order", () => {
    const html = renderToString(tree([pricing, reports]))
    const text = textOf(html)

    // usePluginId() and the host's props both work during a server render.
    expect(text).toContain("pricing in pricing (current)")
    expect(text.indexOf("pricing in")).toBeLessThan(text.indexOf("reports"))
  })

  it("hydrates the server HTML without a mismatch", () => {
    const html = renderToString(tree([pricing, reports]))
    const reported = collectReports()

    hydrateInto(html, tree([pricing, reports]))

    expect(reported.all).toEqual([])
  })

  it("mismatches when the client is given a different plugin list", () => {
    const html = renderToString(tree([pricing, reports]))
    const reported = collectReports()

    // The library's whole SSR contract in one negative test.
    hydrateInto(html, tree([pricing]))

    expect(reported.text).toMatch(/server|hydrat/i)
  })

  it("mismatches when the client is given the same plugins in another order", () => {
    const sameOrder = definePlugin({
      id: "reports",
      contributes: [
        NavMenu.contribute({ order: 0, component: () => <li>reports</li> }),
      ],
    })

    const html = renderToString(tree([pricing, sameOrder]))
    const reported = collectReports()

    // Equal ranks are broken by list position, so reordering the list is a
    // different markup — the sneakier half of "the same list, in the same
    // order".
    hydrateInto(html, tree([sameOrder, pricing]))

    expect(reported.text).toMatch(/server|hydrat/i)
  })

  it("leaves a runtime fill out of the server HTML, then adds it on the client", () => {
    const Menu = defineSlot("runtime-only")

    const tree = (
      <PluginProvider plugins={[]}>
        <ul>
          <Menu.Host>
            <li>placeholder</li>
          </Menu.Host>
        </ul>
        <Menu.Fill>
          <li>runtime</li>
        </Menu.Fill>
      </PluginProvider>
    )

    const reported = collectReports()
    const html = renderToString(tree)

    // Registering from a layout effect is what a server render complains
    // about, and jsdom is exactly where the library has to choose: `window`
    // exists here, and `renderToString` still has to pass in silence.
    expect(reported.all).toEqual([])

    // The runtime channel is invisible to a server render by construction, so
    // the host ships its placeholder instead.
    expect(textOf(html)).toContain("placeholder")
    expect(textOf(html)).not.toContain("runtime")

    const { container } = hydrateInto(html, tree)

    // Hydration matches what the server sent; the fill arrives in the effect
    // that follows it.
    expect(
      reported.all.filter((report) => /hydrat|server/i.test(report)),
    ).toEqual([])
    expect(
      Array.from(container.querySelectorAll("li")).map((li) => li.textContent),
    ).toEqual(["runtime"])
  })

  it("threads a runtime fill between two declared ones after hydration", () => {
    const html = renderToString(tree([pricing, reports]))
    const reported = collectReports()

    const { container } = hydrateInto(
      html,
      <PluginProvider plugins={[pricing, reports]}>
        <App current="/pricing" />
        <NavMenu.Fill order={5}>
          <li>runtime</li>
        </NavMenu.Fill>
      </PluginProvider>,
    )

    // The fill is absent from the markup being hydrated and arrives in the
    // effect after it, so it takes its rank without a mismatch.
    expect(html).not.toContain("runtime")
    expect(
      reported.all.filter((report) => /hydrat|server/i.test(report)),
    ).toEqual([])
    expect(
      Array.from(container.querySelectorAll("li")).map((li) =>
        li.textContent?.trim(),
      ),
    ).toEqual(["pricing in pricing (current)", "runtime", "reports"])
  })

  it("renders the same markup whatever the client has registered", () => {
    const Menu = defineSlot("ssr-shared-store")
    const first = renderToString(tree([pricing, reports]))

    // A live client tree, putting fills into the module-level store in between
    // the two server renders.
    render(
      <PluginProvider plugins={[]}>
        <ul>
          <Menu.Host />
        </ul>
        <Menu.Fill>
          <li>client only</li>
        </Menu.Fill>
      </PluginProvider>,
    )

    const second = renderToString(tree([pricing, reports]))
    const sharedSlot = renderToString(
      <PluginProvider plugins={[]}>
        <ul>
          <Menu.Host>
            <li>placeholder</li>
          </Menu.Host>
        </ul>
      </PluginProvider>,
    )

    // The store belongs to this loaded copy of the module. Concurrent server
    // renders are safe because none reads it — `getServerSnapshot` is empty by
    // construction — and that is the same property that makes server markup a
    // function of the plugin list alone, byte for byte.
    expect(second).toBe(first)
    expect(textOf(sharedSlot)).toBe("placeholder")
  })

  it("refuses a host outside the provider on the server too", () => {
    const Orphan = defineSlot("ssr-orphan")

    expect(() => renderToString(<Orphan.Host />)).toThrow(
      "[create-slot] Slot host rendered outside of 'PluginProvider'",
    )
  })

  it("isolates a failing contribution on the server too", () => {
    const tree = (
      <PluginProvider plugins={[broken, reports]} renderFailed={renderFailed}>
        <App current="/" />
      </PluginProvider>
    )

    const html = renderToString(tree)

    // `getDerivedStateFromError` does not run on the server, but the Suspense
    // boundary around each contribution does its job: React marks just that
    // boundary for a client render (<!--$!-->) and keeps the rest of the HTML.
    expect(html).toContain("<!--$!-->")
    expect(textOf(html)).toContain("reports")

    const reported = collectReports()

    hydrateInto(html, tree)

    // On the client the same boundary re-renders, the class boundary catches,
    // and the host's fallback finally appears.
    expect(
      Array.from(document.querySelectorAll("li")).map((li) => li.textContent),
    ).toEqual(["broken failed", "reports"])
    expect(reported.text).toContain("boom")
  })
})
