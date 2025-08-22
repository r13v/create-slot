## Create Slot

Render React content elsewhere in your component tree — without portals, props drilling, or state juggling. `create-slot` gives you ergonomic, type-safe slots that can be filled by features anywhere in your app and rendered inside one or more designated hosts.

---

### Why `create-slot`?

- **Simple mental model**: Features declare what they render; pages/layouts decide where it appears.
- **Type-safe**: Strongly typed host props via generics and `useProps()`.
- **Zero dependencies**: Tiny surface area, easy to read and reason about.
- **Multiple hosts**: The same fill can render in every mounted host instance.
- **Declarative ordering**: Control placement with an optional `order`.
- **Great DX**: No portals, no global stores, no prop-drilling.

---

### Installation

```sh
npm install create-slot
# or
pnpm add create-slot
# or
yarn add create-slot
```

---

### Quick start

```tsx
import * as React from "react"
import { createSlot } from "create-slot"

// 1) Define your slots
const Slots = {
  Menu: createSlot<{ n: number; inc: () => void }>(),
}

// 2) Place a Host where content should render
function Menu() {
  const [n, inc] = React.useReducer((x) => x + 1, 0)

  return (
    <aside>
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
    </aside>
  )
}

// 3) Fill the slot from anywhere
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
```

---

### How it works

- A call to `createSlot<T>()` returns a Slot component with two extras: `Host` and `useProps()`.
- Renders of `<Slot/>` register a “fill” (a React element). Mounting/unmounting updates every mounted `Host`.
- Each `Host` renders either its children (as a default) or the active fills, in `order`.
- `useProps()` gives fills access to the nearest `Host` props — so fills can adapt per host.

This enables patterns like a shared menu that features can contribute to, or multiple lists where each item adapts to its host’s props.

---

### API

```ts
function createSlot<T>(): Slot<T>
```

```ts
type Slot<Props> = React.FC<{
  children: React.ReactElement
  order?: number
}> & {
  Host: React.FC<React.PropsWithChildren<Props>>
  useProps(): Props
}
```

- **`<Slot order?>`**: Registers a fill to be rendered inside every mounted `Slot.Host`. `order` controls position.
- **`<Slot.Host {...props}>default</Slot.Host>`**: Declares where fills render and provides typed props to fills via `useProps()`.
- **`Slot.useProps()`**: Access the current host’s props from within a fill.

Behavioral notes:

- If no fills are mounted, the host renders its own children (default UI).
- When a fill unmounts, it is removed from all hosts.
- Multiple hosts of the same slot each render the same set of fills, but `useProps()` reflects the props of the host doing the rendering.

---

### Patterns and recipes

- **Multiple hosts (grids, lists, toolbars)**

  ```tsx
  const Slots = { Item: createSlot<{ n: number }>() }

  function Grid() {
    return (
      <ul>
        {[1, 2, 3].map((n) => (
          <Slots.Item.Host key={n} n={n}>
            <li>Default {n}</li>
          </Slots.Item.Host>
        ))}
      </ul>
    )
  }

  function CustomItem() {
    const { n } = Slots.Item.useProps()
    if (n === 2) return null // selectively hide on a specific host
    return <li>Custom {n}</li>
  }

  function Feature() {
    return (
      <Slots.Item>
        <CustomItem />
      </Slots.Item>
    )
  }
  ```

- **Delayed/default content**

  ```tsx
  const Slots = { Delayed: createSlot() }

  function PlaceholderArea() {
    return (
      <Slots.Delayed.Host>
        <li>Loading default…</li>
      </Slots.Delayed.Host>
    )
  }

  function FillLater() {
    return (
      <Slots.Delayed>
        <li>Loaded content</li>
      </Slots.Delayed>
    )
  }
  ```

- **Typed host props**

  ```tsx
  const Slots = { Menu: createSlot<{ n: number; inc: () => void }>() }

  function HostPropsExample() {
    const { n, inc } = Slots.Menu.useProps()
    return <button onClick={inc}>Host counter: {n}</button>
  }
  ```

---

### Comparison

- **vs Portals**: Portals move DOM nodes; `create-slot` composes UI logically and keeps context local to each host.
- **vs Context-only approaches**: You don’t push arrays of elements through global context; fills declare themselves and hosts render them.
- **vs Global stores**: No shared external state, just React components and effects.

---

### TypeScript

First-class types. Pass your host prop type to `createSlot<T>()` and use `Slot.useProps()` for strict inference.

---

### FAQ

- **Can I have multiple hosts for the same slot?** Yes. Every host renders the same fills, ordered by `order`.
- **What if no fills are mounted?** The host renders its own children as defaults.
- **How do I control position?** Pass a numeric `order` to each fill.
- **Does it work with SSR?** Hosts use `useLayoutEffect` internally, which runs on the client. Rendering on the server is fine; effects run after hydration.

---

### Example app

See `src/app.tsx` for a small demo showcasing:

- A `Menu` with host props and interactive fills
- Multiple hosts (`MenuItem`)
- Delayed host mounting (`Delayed`)

---

### License

MIT
