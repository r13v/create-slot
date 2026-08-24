## Create Slot

Render React content in a different place in your component tree. You do not need portals, prop drilling, or shared state. `create-slot` gives you type-safe slots. Any feature in your app can fill a slot, and one or more hosts render the content.

**[Documentation](https://r13v.github.io/create-slot)** — guides, live demos, and a type-checked API reference, plus an [FAQ](https://r13v.github.io/create-slot/faqs).

**For AI agents** — install the [create-slot skill](https://r13v.github.io/create-slot/ai-agents) so your coding agent reads the current docs, or point it straight at the [LLM documentation index](https://r13v.github.io/create-slot/llms.txt) and the [full documentation for LLMs](https://r13v.github.io/create-slot/llms-full.txt).

---

### Why `create-slot`?

- **Simple model**: features declare what they render. Pages and layouts decide where it appears.
- **Type-safe**: host props are typed through generics and `useProps()`.
- **No dependencies**: a small API surface.
- **Multiple hosts**: one fill renders in every mounted host.
- **Ordering**: control the position with the optional `order` prop.
- **Server rendering**: use the plugin registry when the content must be in the HTML.

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

- `createSlot<T>()` returns a Slot component with two extras: `Host` and `useProps()`.
- When a `<Slot>` renders, it registers a fill. A fill is a React element with an `order`.
- Each `Host` renders the active fills in `order`. If there are no fills, the host renders its own children.
- `useProps()` gives a fill the props of the host that renders it. One fill can adapt to each host.

Use this pattern for a shared menu that many features contribute to, or for a list where each item adapts to its host.

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

- **`<Slot order?>`** registers a fill. Every mounted `Slot.Host` renders it. `order` controls the position.
- **`<Slot.Host {...props}>default</Slot.Host>`** declares where fills render. It also gives typed props to the fills.
- **`Slot.useProps()`** returns the props of the current host. Call it inside a fill.

Behavior:

- If no fills are mounted, the host renders its own children as the default UI.
- When a fill unmounts, all hosts remove it.
- Many hosts of one slot render the same fills. `useProps()` returns the props of the host that renders the fill.
- `order` is a priority, not an array index. Two fills with the same `order` both render, in registration order.
- `order` is read one time, when the fill mounts. A later change does not move the fill.

For more, see the [slots guide](https://r13v.github.io/create-slot/slots), [ordering](https://r13v.github.io/create-slot/ordering), and [recipes](https://r13v.github.io/create-slot/recipes).

---

### Server rendering: the plugin registry

A fill registers from an effect, and effects do not run on the server. The server sends the children of each host, and the fills replace them after hydration.

If the content must be in the HTML, use the plugin registry. A contribution is data, so a host can render it synchronously on the server:

```tsx
import { definePlugin, defineSlot, PluginProvider } from "create-slot"

const NavMenu = defineSlot<{ current: string }>("nav-menu")

const pricing = definePlugin({
  id: "pricing",
  contributes: [NavMenu.contribute({ order: 10, component: PricingNavItem })],
})

;<PluginProvider plugins={enabledPlugins}>
  <ul>
    <NavMenu.Host current={route} />
  </ul>
</PluginProvider>
```

The only requirement for SSR is that the server and the client get the same plugin array, in the same order.

Both channels feed the same host and use the same `order`, so you can mix them. Use the registry for content that must be in the HTML. Use `createSlot` for content that depends on live tree state.

See the [registry guide](https://r13v.github.io/create-slot/registry) for the full API, and [server rendering](https://r13v.github.io/create-slot/server-rendering) for the details.

---

### Comparison

- **Portals** move DOM nodes. `create-slot` composes the UI logically and keeps context local to each host.
- **Context** requires you to push arrays of elements through a shared value. With `create-slot`, fills declare themselves and hosts render them.
- **Global stores** must be read and written by your code. The store of `create-slot` is internal.

---

### Examples

Three versions of one CRM. The SPA uses `createSlot` only. The two Next.js apps share `examples/crm-core` and render the same plugin manifest.

```sh
npm run dev:spa        # http://localhost:5173 — client-rendered, createSlot only
npm run dev:next-pages # http://localhost:3000 — Next.js pages router, SSR
npm run dev:next-app   # http://localhost:3001 — Next.js app router, RSC + streaming
```

- **[examples/spa](examples/spa)** — a plugin is a component. To install it, mount it as a child of the shell. Per-row hosts give the same fill different props.
- **[examples/nextjs-pages](examples/nextjs-pages)** — the registry instead. View the page source to see the contributions in the HTML that the server sends.
- **[examples/nextjs-app](examples/nextjs-app)** — the same app with React Server Components. One slow contribution streams in after the rest of the page.

---

### License

MIT
