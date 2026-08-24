import { render } from "@testing-library/react"
import { bench, describe } from "vitest"

import {
  definePlugin,
  defineSlot,
  type PluginDefinition,
  PluginProvider,
} from "./create-slot"

/**
 * How the registry's cost grows.
 *
 * These are comparative, not absolute: the number is jsdom's as much as it is
 * the library's, and only its shape across sizes means anything. Run them
 * before and after a change to the host's render path.
 *
 * What they cannot see is the waste worth caring about — a contribution that
 * re-renders for no reason costs almost nothing here and a great deal in a real
 * application. That is what `perf.test.tsx` measures instead.
 */

function contribution(name: string) {
  function Item({ zoom }: { zoom: number }) {
    return <li>{`${name}:${zoom}`}</li>
  }

  return Item
}

function manifest(slot: string, count: number): PluginDefinition[] {
  const target = defineSlot<{ zoom: number }>(slot)

  return Array.from({ length: count }, (_, i) =>
    definePlugin({
      id: `plugin-${i}`,
      contributes: [
        target.contribute({ order: i, component: contribution(`c${i}`) }),
      ],
    }),
  )
}

for (const size of [10, 100]) {
  describe(`${size} contributions`, () => {
    const Toolbar = defineSlot<{ zoom: number }>(`bench-mount-${size}`)
    const plugins = manifest(`bench-mount-${size}`, size)

    bench("mount", () => {
      const { unmount } = render(
        <PluginProvider plugins={plugins}>
          <ul>
            <Toolbar.Host zoom={1} />
          </ul>
        </PluginProvider>,
      )

      unmount()
    })
  })

  describe(`${size} contributions, host re-rendered`, () => {
    const Toolbar = defineSlot<{ zoom: number }>(`bench-update-${size}`)
    const plugins = manifest(`bench-update-${size}`, size)

    const tree = (zoom: number) => (
      <PluginProvider plugins={plugins}>
        <ul>
          <Toolbar.Host zoom={zoom} />
        </ul>
      </PluginProvider>
    )

    const { rerender } = render(tree(1))
    let zoom = 1

    bench("same props", () => {
      rerender(tree(1))
    })

    bench("changed props", () => {
      zoom += 1
      rerender(tree(zoom))
    })
  })
}
