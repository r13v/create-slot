import React from "react"

import { createSlot } from "../lib/create-slot"

const Slots = {
  Menu: createSlot<{ n: number; inc: () => void }>(),
  MenuItem: createSlot<{ n: number }>(),
  Delayed: createSlot(),
}

export function App() {
  const [a, setA] = React.useState(true)
  const [b, setB] = React.useState(true)
  const [c, setC] = React.useState(true)

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

        <button onClick={() => setC((x) => !x)}>
          Custom Menu Item ({c ? "enabled" : "disabled"})
        </button>
      </div>

      <Menu />

      {a && <FeatureA />}
      {b && <FeatureB />}

      {c && <CustomMenuItemFeature />}

      <DelayedFill />
    </div>
  )
}

function Menu() {
  const [n, inc] = React.useReducer((x) => x + 1, 0)

  const [isDelayedVisible, setIsDelayedVisible] = React.useState(false)

  React.useEffect(() => {
    setTimeout(() => {
      setIsDelayedVisible(true)
    }, 1000)
  }, [])

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

      <h2>Multiple Hosts</h2>
      <ul>
        {[1, 2, 3].map((n) => {
          return (
            <Slots.MenuItem.Host key={n} n={n}>
              <li>Default {n}</li>
            </Slots.MenuItem.Host>
          )
        })}
      </ul>

      {isDelayedVisible && (
        <Slots.Delayed.Host>
          <li>Delayed default</li>
        </Slots.Delayed.Host>
      )}
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

function CustomMenuItemFeature() {
  return (
    <Slots.MenuItem>
      <CustomMenuItem />
    </Slots.MenuItem>
  )
}

function CustomMenuItem() {
  const { n } = Slots.MenuItem.useProps()

  if (n === 2) {
    return null
  }

  return <li>Custom {n}</li>
}

function DelayedFill() {
  return (
    <Slots.Delayed>
      <li>Delayed fill</li>
    </Slots.Delayed>
  )
}
