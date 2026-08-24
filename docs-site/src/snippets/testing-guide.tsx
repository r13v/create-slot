// @jsx: react-jsx
"use client"

// [!region prelude]
import { definePlugin, defineSlot, PluginProvider } from "create-slot"
import type { ReactNode } from "react"

const Toolbar = defineSlot("toolbar")

declare function render(ui: ReactNode): { container: HTMLElement }
declare function expect(value: unknown): { toEqual(other: unknown): void }
declare function test(name: string, run: () => void): void
// [!endregion prelude]

// [!region testing]
// Testing the wiring: render the host inside a provider and assert the output.
const search = definePlugin({
  id: "search",
  contributes: [
    Toolbar.contribute({ order: 10, component: () => <li>Search</li> }),
  ],
})

const filters = definePlugin({
  id: "filters",
  contributes: [
    Toolbar.contribute({ order: 20, component: () => <li>Filters</li> }),
  ],
})

test("plugins render in order", () => {
  const { container } = render(
    <PluginProvider plugins={[filters, search]}>
      <ul>
        <Toolbar.Host />
      </ul>
    </PluginProvider>,
  )

  // Ranked by `order`, not by position in the array.
  expect(
    [...container.querySelectorAll("li")].map((li) => li.textContent),
  ).toEqual(["Search", "Filters"])
})
// [!endregion testing]
