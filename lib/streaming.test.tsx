// @vitest-environment node
import { Writable } from "node:stream"
import { type ReactElement, Suspense } from "react"
import { renderToPipeableStream } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { definePlugin, defineSlot, PluginProvider } from "./create-slot"

const NavMenu = defineSlot("nav-menu")

type StreamResult = {
  /** Everything flushed before the suspended work was allowed to finish. */
  shell: string
  full: string
  errors: unknown[]
}

function stream(
  element: ReactElement,
  afterShell?: () => void,
): Promise<StreamResult> {
  return new Promise((resolve, reject) => {
    const errors: unknown[] = []
    let out = ""
    let shell = ""

    const destination = new Writable({
      write(chunk, _encoding, callback) {
        out += String(chunk)
        callback()
      },
      final(callback) {
        resolve({ shell, full: out, errors })
        callback()
      },
    })

    const pipeable = renderToPipeableStream(element, {
      onShellReady() {
        pipeable.pipe(destination)

        setImmediate(() => {
          shell = out
          afterShell?.()
        })
      },
      onShellError: reject,
      // Must not return a value: React validates onError's return type.
      onError(error) {
        errors.push(error)
      },
    })
  })
}

const sibling = definePlugin({
  id: "sibling",
  contributes: [
    NavMenu.contribute({ order: 100, component: () => <li>sibling</li> }),
  ],
})

describe("registry streaming", () => {
  it("flushes the shell before a suspended contribution resolves", async () => {
    let value: string | null = null
    let release!: () => void

    const pending = new Promise<void>((resolve) => {
      release = resolve
    }).then(() => {
      value = "late rows"
    })

    function LateContent() {
      if (value === null) {
        throw pending
      }

      return <li>{value}</li>
    }

    // A contribution brings its own fallback: the library has no `pending` prop.
    function SlowContribution() {
      return (
        <Suspense fallback={<li>loading</li>}>
          <LateContent />
        </Suspense>
      )
    }

    const slow = definePlugin({
      id: "slow",
      contributes: [
        NavMenu.contribute({ order: 0, component: SlowContribution }),
      ],
    })

    const { shell, full } = await stream(
      <PluginProvider plugins={[slow, sibling]}>
        <ul>
          <NavMenu.Host />
        </ul>
      </PluginProvider>,
      () => release(),
    )

    // The slow plugin holds up its own line and nothing else.
    expect(shell).toContain("loading")
    expect(shell).toContain("sibling")
    expect(shell).not.toContain("late rows")

    // React streams the resolved content in and swaps the fallback out.
    expect(full).toContain("late rows")
  })

  it("fixes the order in the shell before any suspended contribution resolves", async () => {
    const release: Record<string, () => void> = {}
    const resolved = new Set<string>()

    const pendingFor = (id: string) => {
      const promise = new Promise<void>((resolve) => {
        release[id] = resolve
      }).then(() => {
        resolved.add(id)
      })

      return promise
    }

    const first = pendingFor("first")
    const last = pendingFor("last")

    const Late = ({ id, promise }: { id: string; promise: Promise<void> }) => {
      if (!resolved.has(id)) {
        throw promise
      }

      return <li>{`late ${id}`}</li>
    }

    const slow = definePlugin({
      id: "slow",
      contributes: [
        NavMenu.contribute({
          order: 0,
          component: () => (
            <Suspense fallback={<li>loading first</li>}>
              <Late id="first" promise={first} />
            </Suspense>
          ),
        }),
        NavMenu.contribute({
          order: 200,
          component: () => (
            <Suspense fallback={<li>loading last</li>}>
              <Late id="last" promise={last} />
            </Suspense>
          ),
        }),
      ],
    })

    const { shell, full, errors } = await stream(
      <PluginProvider plugins={[slow, sibling]}>
        <ul>
          <NavMenu.Host />
        </ul>
      </PluginProvider>,
      () => {
        // Deliberately backwards: the later contribution finishes first.
        release.last()
        release.first()
      },
    )

    // Every rank already has its place in the shell, so which contribution
    // finishes first cannot decide where its content lands.
    expect(shell.indexOf("loading first")).toBeLessThan(
      shell.indexOf("sibling"),
    )
    expect(shell.indexOf("sibling")).toBeLessThan(shell.indexOf("loading last"))

    expect(full).toContain("late first")
    expect(full).toContain("late last")
    expect(errors).toEqual([])
  })

  it("leaves a runtime fill out of a stream entirely", async () => {
    const Menu = defineSlot("streaming-runtime")

    const { full, errors } = await stream(
      <PluginProvider plugins={[]}>
        <ul>
          <Menu.Host>
            <li>placeholder</li>
          </Menu.Host>
        </ul>
        <Menu.Fill>
          <li>runtime</li>
        </Menu.Fill>
      </PluginProvider>,
    )

    // Off jsdom there is no `window`, so the fill's registration is a passive
    // effect that a server render never runs. Rendering one is still legal.
    expect(full).toContain("placeholder")
    expect(full).not.toContain("runtime")
    expect(errors).toEqual([])
  })

  it("keeps the rest of the HTML when a contribution throws", async () => {
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

    // Nothing suspends here, so the whole stream completes in one pass and
    // `shell` never gets a separate snapshot — assert on the full output.
    const { full, errors } = await stream(
      <PluginProvider plugins={[broken, sibling]}>
        <ul>
          <NavMenu.Host />
        </ul>
      </PluginProvider>,
    )

    // Reported through the stream's own onError, and the shell still ships:
    // React marks just that boundary for a client render.
    expect(errors.map(String).join("")).toContain("boom")
    expect(full).toContain("sibling")
    expect(full).toContain("<!--$!-->")
  })
})
