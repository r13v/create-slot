// @jsx: react-jsx
"use client"

// [!region prelude]
import {
  definePlugin,
  defineSlot,
  resolvePlugins,
  SlotHost,
  SlotProvider,
} from "create-slot"
import type { ReactNode } from "react"

const Toolbar = defineSlot("toolbar")

declare function render(ui: ReactNode): { container: HTMLElement }
declare function expect(value: unknown): { toEqual(other: unknown): void }
declare function test(name: string, run: () => void): void
// [!endregion prelude]

// [!region testing]
// Testing the wiring: resolve, hand the Resolution to a provider, and assert
// on the host's output.
const search = definePlugin({
  id: "search",
  contributes: [
    Toolbar.contribute("button", {
      order: 10,
      component: () => <li>Search</li>,
    }),
  ],
})

const filters = definePlugin({
  id: "filters",
  contributes: [
    Toolbar.contribute("button", {
      order: 20,
      component: () => <li>Filters</li>,
    }),
  ],
})

test("plugins render in order", () => {
  const { container } = render(
    <SlotProvider resolution={resolvePlugins([filters, search])}>
      <ul>
        <SlotHost slot={Toolbar} />
      </ul>
    </SlotProvider>,
  )

  // Ranked by `order`, not by position in the array.
  expect(
    [...container.querySelectorAll("li")].map((li) => li.textContent),
  ).toEqual(["Search", "Filters"])
})
// [!endregion testing]

// [!region diagnostics]
// The catalog validator is one line: the resolver reports every manifest
// defect — duplicate ids, invalid ids, unknown disable and override targets —
// as data instead of throwing.
test("the catalog is clean", () => {
  expect(resolvePlugins([search, filters]).diagnostics).toEqual([])
})
// [!endregion diagnostics]
