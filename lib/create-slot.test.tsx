import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect } from "vitest"

import { createSlot } from "./create-slot"

function getListItemTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("li")).map(
    (li) => li.textContent?.trim() ?? "",
  )
}

describe("createSlot", () => {
  it("renders Host children as placeholder when there are no fills", () => {
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }

    function Menu() {
      return (
        <ul>
          <Slots.Menu.Host n={0} inc={() => {}}>
            <li>Placeholder</li>
          </Slots.Menu.Host>
        </ul>
      )
    }

    render(<Menu />)

    expect(screen.getByText("Placeholder")).toBeInTheDocument()
  })

  it("renders fills instead of placeholder once a Slot mounts", () => {
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }

    function FeatureA() {
      return (
        <Slots.Menu order={0}>
          <li>Feature A</li>
        </Slots.Menu>
      )
    }

    function Menu() {
      return (
        <ul>
          <Slots.Menu.Host n={0} inc={() => {}}>
            <li>Placeholder</li>
          </Slots.Menu.Host>
        </ul>
      )
    }

    render(
      <>
        <Menu />
        <FeatureA />
      </>,
    )

    expect(screen.queryByText("Placeholder")).not.toBeInTheDocument()
    expect(screen.getByText("Feature A")).toBeInTheDocument()
  })

  it("orders multiple fills by their order key", () => {
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }

    function FeatureA() {
      return (
        <Slots.Menu order={0}>
          <li>Feature A</li>
        </Slots.Menu>
      )
    }

    function FeatureB() {
      return (
        <Slots.Menu order={1}>
          <li>Feature B</li>
        </Slots.Menu>
      )
    }

    function Menu() {
      return (
        <ul data-testid="menu">
          <Slots.Menu.Host n={0} inc={() => {}}>
            <li>Placeholder</li>
          </Slots.Menu.Host>
        </ul>
      )
    }

    const { container } = render(
      <>
        <Menu />
        <FeatureA />
        <FeatureB />
      </>,
    )

    const list = within(container).getByTestId("menu")
    expect(getListItemTexts(list)).toEqual(["Feature A", "Feature B"])
  })

  it("removes fills when Slots unmount; shows placeholder if no fills remain", () => {
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }

    function FeatureA() {
      return (
        <Slots.Menu order={0}>
          <li>Feature A</li>
        </Slots.Menu>
      )
    }

    function FeatureB() {
      return (
        <Slots.Menu order={1}>
          <li>Feature B</li>
        </Slots.Menu>
      )
    }

    function App({ showA, showB }: { showA: boolean; showB: boolean }) {
      return (
        <>
          <ul data-testid="menu">
            <Slots.Menu.Host n={0} inc={() => {}}>
              <li>Placeholder</li>
            </Slots.Menu.Host>
          </ul>
          {showA && <FeatureA />}
          {showB && <FeatureB />}
        </>
      )
    }

    const { rerender, container } = render(<App showA={true} showB={true} />)
    let list = within(container).getByTestId("menu")
    expect(getListItemTexts(list)).toEqual(["Feature A", "Feature B"])

    rerender(<App showA={false} showB={true} />)
    list = within(container).getByTestId("menu")
    expect(getListItemTexts(list)).toEqual(["Feature B"])

    rerender(<App showA={false} showB={false} />)
    list = within(container).getByTestId("menu")
    expect(getListItemTexts(list)).toEqual(["Placeholder"])
  })

  it("exposes Host props via useProps to fills", async () => {
    const user = userEvent.setup()
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }

    function HostPropsExample() {
      const { n, inc } = Slots.Menu.useProps()
      return <button onClick={inc}>Host counter: {n}</button>
    }

    function FeatureB() {
      return (
        <Slots.Menu order={1}>
          <li>
            Feature B <HostPropsExample />
          </li>
        </Slots.Menu>
      )
    }

    function Menu() {
      const [n, inc] = React.useReducer((x: number) => x + 1, 0)
      return (
        <ul>
          <Slots.Menu.Host n={n} inc={inc}>
            <li>Placeholder</li>
          </Slots.Menu.Host>
        </ul>
      )
    }

    render(
      <>
        <Menu />
        <FeatureB />
      </>,
    )

    const btn = await screen.findByRole("button", { name: /Host counter: 0/ })
    await user.click(btn)
    expect(
      await screen.findByRole("button", { name: /Host counter: 1/ }),
    ).toBeInTheDocument()
  })

  it("renders fills into multiple Hosts created from the same Slot factory", () => {
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }

    function FeatureA() {
      return (
        <Slots.Menu order={0}>
          <li>Feature A</li>
        </Slots.Menu>
      )
    }

    function Menus() {
      return (
        <div>
          <ul data-testid="menu-1">
            <Slots.Menu.Host n={0} inc={() => {}}>
              <li>Placeholder 1</li>
            </Slots.Menu.Host>
          </ul>
          <ul data-testid="menu-2">
            <Slots.Menu.Host n={0} inc={() => {}}>
              <li>Placeholder 2</li>
            </Slots.Menu.Host>
          </ul>
        </div>
      )
    }

    const { container } = render(
      <>
        <Menus />
        <FeatureA />
      </>,
    )

    const menu1 = within(container).getByTestId("menu-1")
    const menu2 = within(container).getByTestId("menu-2")
    expect(getListItemTexts(menu1)).toEqual(["Feature A"])
    expect(getListItemTexts(menu2)).toEqual(["Feature A"])
  })

  it("updates fill content on Slot child change without remounting", async () => {
    const user = userEvent.setup()
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }
    let mounts = 0
    let unmounts = 0

    function Child({ label }: { label: string }) {
      React.useEffect(() => {
        mounts++
        return () => {
          unmounts++
        }
      }, [])
      return <span data-testid="child">{label}</span>
    }

    function App() {
      const [label, setLabel] = React.useState("A")
      return (
        <>
          <button onClick={() => setLabel((x) => (x === "A" ? "B" : "A"))}>
            Toggle
          </button>
          <ul>
            <Slots.Menu.Host n={0} inc={() => {}}>
              <li>Placeholder</li>
            </Slots.Menu.Host>
          </ul>
          <Slots.Menu order={0}>
            <li>
              <Child label={label} />
            </li>
          </Slots.Menu>
        </>
      )
    }

    render(<App />)

    expect(screen.getAllByTestId("child").map((el) => el.textContent)).toEqual([
      "A",
    ])
    expect(mounts).toBe(1)
    expect(unmounts).toBe(0)

    await user.click(screen.getByRole("button", { name: "Toggle" }))

    expect(screen.getAllByTestId("child").map((el) => el.textContent)).toEqual([
      "B",
    ])
    expect(mounts).toBe(1)
    expect(unmounts).toBe(0)
  })

  it("does not remount fill when Host context props change", async () => {
    const user = userEvent.setup()
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }
    let mounts = 0

    function Child() {
      React.useEffect(() => {
        mounts++
      }, [])
      const { n, inc } = Slots.Menu.useProps()
      return (
        <button onClick={inc} data-testid="ctx-btn">
          n: {n}
        </button>
      )
    }

    function App() {
      const [n, inc] = React.useReducer((x: number) => x + 1, 0)
      return (
        <>
          <ul>
            <Slots.Menu.Host n={n} inc={inc}>
              <li>Placeholder</li>
            </Slots.Menu.Host>
          </ul>
          <Slots.Menu order={0}>
            <li>
              <Child />
            </li>
          </Slots.Menu>
        </>
      )
    }

    render(<App />)
    const btn = screen.getByTestId("ctx-btn")
    expect(btn).toHaveTextContent("n: 0")

    await user.click(btn)
    expect(btn).toHaveTextContent("n: 1")

    await user.click(btn)
    expect(btn).toHaveTextContent("n: 2")

    expect(mounts).toBe(1)
  })

  it("throws if a Slot is rendered without children", () => {
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }

    // Cast to any to bypass TS children requirement and assert runtime error
    expect(() =>
      render(
        React.createElement(
          Slots.Menu as unknown as React.ComponentType<Record<string, unknown>>,
          { order: 0 },
        ) as React.ReactElement,
      ),
    ).toThrow("'Slot' without children rendered")
  })

  it("backfills fills into a Host that mounts later", () => {
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }

    function FeatureA() {
      return (
        <Slots.Menu order={0}>
          <li>Feature A</li>
        </Slots.Menu>
      )
    }

    function App({ showHost }: { showHost: boolean }) {
      return (
        <>
          {showHost && (
            <ul data-testid="menu">
              <Slots.Menu.Host n={0} inc={() => {}}>
                <li>Placeholder</li>
              </Slots.Menu.Host>
            </ul>
          )}
          <FeatureA />
        </>
      )
    }

    const { rerender, container } = render(<App showHost={false} />)

    // Mount Host after the fill is already mounted
    rerender(<App showHost={true} />)

    const list = within(container).getByTestId("menu")
    expect(getListItemTexts(list)).toEqual(["Feature A"])
  })

  it("isolates fills and Hosts across different Slot factories", () => {
    const SlotsA = { Menu: createSlot<{ n: number; inc: () => void }>() }
    const SlotsB = { Menu: createSlot<{ n: number; inc: () => void }>() }

    function FeatureA() {
      return (
        <SlotsA.Menu order={0}>
          <li>Feature A</li>
        </SlotsA.Menu>
      )
    }

    function FeatureB() {
      return (
        <SlotsB.Menu order={0}>
          <li>Feature B</li>
        </SlotsB.Menu>
      )
    }

    function Menus() {
      return (
        <div>
          <ul data-testid="menu-a">
            <SlotsA.Menu.Host n={0} inc={() => {}}>
              <li>Placeholder A</li>
            </SlotsA.Menu.Host>
          </ul>
          <ul data-testid="menu-b">
            <SlotsB.Menu.Host n={0} inc={() => {}}>
              <li>Placeholder B</li>
            </SlotsB.Menu.Host>
          </ul>
        </div>
      )
    }

    const { container } = render(
      <>
        <Menus />
        <FeatureA />
        <FeatureB />
      </>,
    )

    const menuA = within(container).getByTestId("menu-a")
    const menuB = within(container).getByTestId("menu-b")
    expect(getListItemTexts(menuA)).toEqual(["Feature A"])
    expect(getListItemTexts(menuB)).toEqual(["Feature B"])
  })

  it("does not remount a fill if its order prop changes", async () => {
    const user = userEvent.setup()
    const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }
    let mounts = 0

    function Child() {
      React.useEffect(() => {
        mounts++
      }, [])
      return <span data-testid="child">X</span>
    }

    function App() {
      const [order, toggle] = React.useReducer(
        (x: number) => (x === 0 ? 1 : 0),
        0,
      )
      return (
        <>
          <button onClick={toggle}>Toggle Order</button>
          <ul>
            <Slots.Menu.Host n={0} inc={() => {}}>
              <li>Placeholder</li>
            </Slots.Menu.Host>
          </ul>
          <Slots.Menu order={order}>
            <li>
              <Child />
            </li>
          </Slots.Menu>
        </>
      )
    }

    render(<App />)
    expect(screen.getAllByTestId("child").length).toBe(1)
    expect(mounts).toBe(1)

    await user.click(screen.getByRole("button", { name: "Toggle Order" }))
    expect(screen.getAllByTestId("child").length).toBe(1)
    expect(mounts).toBe(1)
  })
})
