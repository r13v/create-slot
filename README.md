# Create Slot

Slots allows developers to render content elsewhere in a React application.

## Installation

```sh
npm install create-slot
```

## Usage

```tsx
import { useState } from "react"
import { createSlot } from "create-slot"

const Slots = {
  Menu: createSlot(),
}

export function App() {
  const [a, setA] = useState(true)
  const [b, setB] = useState(true)

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
  return (
    <div>
      <h1>Menu </h1>

      <ul>
        <li>Home</li>
        <li>Products</li>

        <Slots.Menu.Host>
          <li>Placeholder</li>
        </Slots.Menu.Host>
      </ul>
    </div>
  )
}

function FeatureA() {
  return (
    <Slots.Menu>
      <li>Feature A</li>
    </Slots.Menu>
  )
}

function FeatureB() {
  return (
    <Slots.Menu>
      <li>Feature B</li>
    </Slots.Menu>
  )
}

```
