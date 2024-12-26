import React from "react"
import { createSlot } from "../lib"

const Slots = {
  Menu: createSlot<{ n: number; inc: () => void }>(),
}

export function App() {
  const [a, setA] = React.useState(true)
  const [b, setB] = React.useState(true)

  return (
    <div>
      <div>
        <h1>App</h1>

        <button onClick={() => setA((x) => !x)}>
          Feature A ({a ? "enabled" : "disabled"})
        </button>

        <button onClick={() => setB((x) => !x)}>
          Feature B ({b ? "enabled" : "disabled"})
        </button>
      </div>

      <Menu />

      {a && <FeatureA />}
      {b && <FeatureB />}
    </div>
  )
}

function Menu() {
  const [n, inc] = React.useReducer((x) => x + 1, 0)

  return (
    <div>
      <h1>
        Menu <button onClick={inc}>{n}</button>
      </h1>

      <ul>
        <li>Home</li>
        <li>Products</li>

        <Slots.Menu.Host n={n} inc={inc}>
          <li>Placeholder</li>
        </Slots.Menu.Host>
      </ul>
    </div>
  )
}

function FeatureA() {
  const [n, inc] = React.useReducer((x) => x + 1, 0)

  return (
    <Slots.Menu order={0}>
      <li>
        Feature A <button onClick={inc}>Inner counter: {n}</button>
      </li>
    </Slots.Menu>
  )
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

function HostPropsExample() {
  const { n, inc } = Slots.Menu.useProps()

  return <button onClick={inc}>Host counter: {n}</button>
}
