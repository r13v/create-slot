import { act, render } from "@testing-library/react"
import type React from "react"
import { Profiler, useEffect, useState } from "react"
import { describe, expect, it } from "vitest"

import {
  createSlot,
  definePlugin,
  defineSlot,
  type PluginDefinition,
  resolvePlugins,
  SlotHost,
  SlotProvider,
} from "./index"

/**
 * Render-cost budgets.
 *
 * A timing in jsdom is noise; a render count is not. Every case here asks one
 * question — who re-renders when this changes? — and the number beside it is
 * the answer the library owes its user, not the one it happens to give.
 *
 * The budgets are written from the host's side of the contract: a slot exists
 * so that a feature can contribute UI without knowing who else did. That
 * promise is broken just as badly by a contribution that re-renders because an
 * unrelated one moved as it is by one that renders in the wrong place.
 */

type Tally = Record<string, number>

/** A contribution that counts how often it was asked to render. */
function probe(tally: Tally, name: string) {
  function Probe() {
    tally[name] = (tally[name] ?? 0) + 1

    return <li>{name}</li>
  }

  Probe.displayName = name

  return Probe
}

function reset(tally: Tally): void {
  for (const key of Object.keys(tally)) {
    tally[key] = 0
  }
}

/**
 * What a subtree actually cost, per commit.
 *
 * The Profiler reports work that was committed, which is not the same as work
 * that was rendered: a component whose re-render produces what was already
 * there commits nothing and is not reported. That is the number worth
 * budgeting — it is the one the browser pays — but it means a zero here says
 * "nothing reached the DOM", and the render tallies beside it say the rest.
 */
function recorder() {
  const commits: string[] = []

  const onRender: React.ProfilerOnRenderCallback = (_id, phase) => {
    commits.push(phase)
  }

  return {
    onRender,
    /** Commits after the mount: what a budget is written against. */
    get updates() {
      return commits.filter((phase) => phase !== "mount").length
    },
    reset() {
      commits.length = 0
    },
  }
}

/** A state setter reached from outside the tree that owns it. */
function trigger() {
  const holder: { fire: (() => void) | null } = { fire: null }

  return {
    hold(fire: () => void) {
      holder.fire = fire
    },
    fire() {
      act(() => holder.fire?.())
    },
  }
}

function plugins(
  tally: Tally,
  slot: string,
  count: number,
): PluginDefinition[] {
  const target = defineSlot<{ zoom: number }>(slot)

  return Array.from({ length: count }, (_, i) =>
    definePlugin({
      id: `plugin-${i}`,
      contributes: [
        target.contribute("entry", {
          order: i,
          component: probe(tally, `c${i}`),
        }),
      ],
    }),
  )
}

describe("isolation between contributions", () => {
  it("leaves declared contributions alone when an unrelated subtree re-renders", () => {
    const tally: Tally = {}
    const Toolbar = defineSlot<{ zoom: number }>("perf.unrelated")
    const manifest = plugins(tally, "perf.unrelated", 5)
    const Panel = createSlot()
    const Fill = probe(tally, "fill")
    const bump = trigger()

    // A façade fill lives beside the host, not under it: only its own subtree
    // re-renders, so anything the declared host does is the library's doing.
    function FillOwner() {
      const [n, setN] = useState(0)

      bump.hold(() => setN((v) => v + 1))

      return (
        <>
          <span data-testid="n">{n}</span>
          <Panel>
            <Fill />
          </Panel>
        </>
      )
    }

    render(
      <SlotProvider resolution={resolvePlugins(manifest)}>
        <ul>
          <SlotHost slot={Toolbar} props={{ zoom: 1 }} />
        </ul>
        <ul>
          <Panel.Host />
        </ul>
        <FillOwner />
      </SlotProvider>,
    )

    reset(tally)
    bump.fire()

    // The fill's own element was rebuilt by its parent, so it renders again.
    expect(tally.fill).toBe(1)

    // Nothing about these five changed. Five features must not pay for a
    // sixth's unrelated state update.
    expect(tally.c0).toBe(0)
    expect(tally.c4).toBe(0)
  })

  it("leaves declared contributions alone when the host's own props are unchanged", () => {
    const tally: Tally = {}
    const Toolbar = defineSlot<{ zoom: number }>("perf.stable-props")
    const manifest = plugins(tally, "perf.stable-props", 5)
    const resolution = resolvePlugins(manifest)
    const bump = trigger()

    function Page() {
      const [n, setN] = useState(0)

      bump.hold(() => setN((v) => v + 1))

      return (
        <>
          <span data-testid="n">{n}</span>
          <ul>
            {/* A fresh props object with the same values, every time. */}
            <SlotHost slot={Toolbar} props={{ zoom: 1 }} />
          </ul>
        </>
      )
    }

    render(
      <SlotProvider resolution={resolution}>
        <Page />
      </SlotProvider>,
    )

    reset(tally)
    bump.fire()

    expect(tally.c0).toBe(0)
    expect(tally.c4).toBe(0)
  })

  it("re-renders only the contributions whose props actually changed", () => {
    const tally: Tally = {}
    const Toolbar = defineSlot<{ zoom: number }>("perf.changed-props")
    const manifest = plugins(tally, "perf.changed-props", 5)
    const resolution = resolvePlugins(manifest)
    const bump = trigger()

    function Page() {
      const [zoom, setZoom] = useState(1)

      bump.hold(() => setZoom((v) => v + 1))

      return (
        <ul>
          <SlotHost slot={Toolbar} props={{ zoom }} />
        </ul>
      )
    }

    render(
      <SlotProvider resolution={resolution}>
        <Page />
      </SlotProvider>,
    )

    reset(tally)
    bump.fire()

    // Here the work is real: the props they are given changed.
    expect(tally.c0).toBe(1)
    expect(tally.c4).toBe(1)
  })

  it("leaves the other fills alone when one fill's content changes", () => {
    const tally: Tally = {}
    const Panel = createSlot<Record<never, never>>()
    const A = probe(tally, "a")
    const B = probe(tally, "b")
    const bump = trigger()

    function OwnerA() {
      const [n, setN] = useState(0)

      bump.hold(() => setN((v) => v + 1))

      return (
        <>
          <span data-testid="n">{n}</span>
          <Panel>
            <A />
          </Panel>
        </>
      )
    }

    render(
      <>
        <ul>
          <Panel.Host />
        </ul>
        <OwnerA />
        <Panel>
          <B />
        </Panel>
      </>,
    )

    reset(tally)
    bump.fire()

    expect(tally.a).toBe(1)
    expect(tally.b).toBe(0)
  })
})

describe("reading the host's props", () => {
  it("does not re-render a fill whose host's props are unchanged", () => {
    const tally: Tally = {}
    const Panel = createSlot<{ zoom: number }>()
    const bump = trigger()

    function Reader() {
      const { zoom } = Panel.useProps()

      tally.reader = (tally.reader ?? 0) + 1

      return <li>{zoom}</li>
    }

    // Held outside the render: the fill's own element never changes, so the
    // only way this can re-render is the props context above it.
    const fill = (
      <Panel>
        <Reader />
      </Panel>
    )

    function Page() {
      const [n, setN] = useState(0)

      bump.hold(() => setN((v) => v + 1))

      return (
        <>
          <span data-testid="n">{n}</span>
          <ul>
            <Panel.Host zoom={1} />
          </ul>
          {fill}
        </>
      )
    }

    render(<Page />)
    reset(tally)
    bump.fire()

    expect(tally.reader).toBe(0)
  })

  it("re-renders a fill when the host's props really change", () => {
    const tally: Tally = {}
    const Panel = createSlot<{ zoom: number }>()
    const bump = trigger()

    function Reader() {
      const { zoom } = Panel.useProps()

      tally.reader = (tally.reader ?? 0) + 1

      return <li data-testid="zoom">{zoom}</li>
    }

    const fill = (
      <Panel>
        <Reader />
      </Panel>
    )

    function Page() {
      const [zoom, setZoom] = useState(1)

      bump.hold(() => setZoom((v) => v + 1))

      return (
        <>
          <ul>
            <Panel.Host zoom={zoom} />
          </ul>
          {fill}
        </>
      )
    }

    const { getByTestId } = render(<Page />)
    reset(tally)
    bump.fire()

    expect(tally.reader).toBe(1)
    expect(getByTestId("zoom").textContent).toBe("2")
  })
})

describe("provider fanout", () => {
  it("does not re-render every host when only the provider's handlers are new", () => {
    const tally: Tally = {}
    const Toolbar = defineSlot<{ zoom: number }>("perf.provider-handlers")
    const manifest = plugins(tally, "perf.provider-handlers", 3)
    const resolution = resolvePlugins(manifest)
    const host = recorder()
    const bump = trigger()

    // Held outside the render, so React's own element-identity bail-out is
    // free to skip this subtree. Anything that reaches it came through context.
    const hosted = (
      <Profiler id="host" onRender={host.onRender}>
        <ul>
          <SlotHost slot={Toolbar} props={{ zoom: 1 }} />
        </ul>
      </Profiler>
    )

    function App() {
      const [n, setN] = useState(0)

      bump.hold(() => setN((v) => v + 1))

      return (
        <SlotProvider
          resolution={resolution}
          // Inline, the way every application writes them.
          onError={() => {}}
          Failed={() => null}
        >
          <span data-testid="n">{n}</span>
          {hosted}
        </SlotProvider>
      )
    }

    render(<App />)
    host.reset()
    reset(tally)
    bump.fire()

    // The resolution did not change, so no host anywhere had new work — and
    // nothing a contribution renders depends on how a failure would be handled.
    expect(host.updates).toBe(0)
    expect(tally.c0).toBe(0)
  })
})

describe("cost of scale", () => {
  it("commits once when many fills mount together", () => {
    const tally: Tally = {}
    const Panel = createSlot<Record<never, never>>()
    const host = recorder()
    const show = trigger()
    const fills = Array.from({ length: 30 }, (_, i) => probe(tally, `f${i}`))

    function FillOwner() {
      const [open, setOpen] = useState(false)

      show.hold(() => setOpen(true))

      return open
        ? fills.map((Fill) => (
            <Panel key={Fill.displayName}>
              <Fill />
            </Panel>
          ))
        : null
    }

    render(
      <>
        <Profiler id="host" onRender={host.onRender}>
          <ul>
            <Panel.Host />
          </ul>
        </Profiler>
        <FillOwner />
      </>,
    )
    host.reset()
    show.fire()

    // Thirty fills arriving in one commit are one change to the slot, so the
    // host has one re-render to do — not one per fill. The one is the floor,
    // not waste: a fill announces itself from an effect, so no host can have
    // known about it while the commit that mounted it was being rendered.
    expect(host.updates).toBe(1)
    expect(tally.f0).toBe(1)
    expect(tally.f29).toBe(1)
  })

  it("re-renders one host, not every host of the slot, for a scoped change", () => {
    const tally: Tally = {}
    const Toolbar = defineSlot<{ zoom: number }>("perf.many-hosts")
    const manifest = plugins(tally, "perf.many-hosts", 3)
    const resolution = resolvePlugins(manifest)
    const second = recorder()
    const bump = trigger()

    function Row({ id }: { id: number }) {
      const [n, setN] = useState(0)

      if (id === 1) {
        bump.hold(() => setN((v) => v + 1))
      }

      return (
        <ul>
          <span>{n}</span>
          <SlotHost slot={Toolbar} props={{ zoom: 1 }} />
        </ul>
      )
    }

    render(
      <SlotProvider resolution={resolution}>
        <Row id={1} />
        <Profiler id="second" onRender={second.onRender}>
          <Row id={2} />
        </Profiler>
      </SlotProvider>,
    )

    second.reset()
    reset(tally)
    bump.fire()

    // Row 2 shares the slot but nothing else. Its own state did not change.
    expect(second.updates).toBe(0)
  })

  it("stops a resolution rebuilt on every render at the boundary shells", () => {
    const tally: Tally = {}
    const Toolbar = defineSlot<{ zoom: number }>("perf.inline-resolution")
    const host = recorder()
    const bump = trigger()
    let mounts = 0

    function Contribution() {
      tally.c0 = (tally.c0 ?? 0) + 1

      useEffect(() => {
        mounts++
      }, [])

      return <li>c0</li>
    }

    // Held outside the render, so the only thing that can reach this subtree
    // is the resolution arriving through context.
    const hosted = (
      <Profiler id="host" onRender={host.onRender}>
        <ul>
          <SlotHost slot={Toolbar} props={{ zoom: 1 }} />
        </ul>
      </Profiler>
    )

    function App() {
      const [n, setN] = useState(0)

      bump.hold(() => setN((v) => v + 1))

      // `resolvePlugins(all, options)` inline: a fresh Resolution, fresh entry
      // objects, fresh plugin objects — on every render. The criterion-5
      // budget: nothing below the boundary shells does any work.
      const resolution = resolvePlugins([
        definePlugin({
          id: "pricing",
          contributes: [
            Toolbar.contribute("entry", { component: Contribution }),
          ],
        }),
      ])

      return (
        <SlotProvider resolution={resolution}>
          <span data-testid="n">{n}</span>
          {hosted}
        </SlotProvider>
      )
    }

    render(<App />)
    host.reset()
    reset(tally)
    bump.fire()

    // A new resolution reaches every host of every slot in it, so every one
    // of them does re-render — and that is the whole bill. Below the host the
    // entries are new objects, and still nothing happens: the entry comparator
    // matches by content, the memoised view is cached on the author's own
    // component, and the host holds its props by value. No contribution
    // renders again, none is torn down and mounted again, and the commit
    // reaches nothing.
    expect(host.updates).toBe(0)
    expect(tally.c0).toBe(0)
    expect(mounts).toBe(1)
  })
})
