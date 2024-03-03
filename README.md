# Create Slot

## Types

```ts
import React from 'react';
import { Domain, Event, Store } from 'effector';

type Params = {
    name?: string;
    domain?: Domain;
};
type FillProps = {
    children: React.ReactElement;
    order?: Order;
};
type Order = number;
type FillPayload = {
    node: React.ReactElement;
    order: Order;
};
type RemovePayload = Order;
type EffectorUnits<Props> = {
    add: Event<FillPayload>;
    remove: Event<RemovePayload>;
    set: Event<FillPayload>;
    props: Store<Props>;
    fills: Store<Array<React.ReactElement>>;
};
type Slot<P> = React.FC<FillProps> & {
    Host: React.FC<React.PropsWithChildren<P>>;
    units: EffectorUnits<P>;
    useProps: () => P;
};
declare function createSlot<Props>(params?: Params): Slot<Props>;

export { createSlot };
```

## Usage

1. Define a slot

```ts
// app-slots.ts

import { createSlot } from 'create-slot'

export const Slots = {
  Menu: createSlot<{ n: number, inc: () => void }>()
} as const

```

2. Place it

```tsx
// menu.tsx

import { useState } from "react"
import { Slots } from "./app-slots"

export const Menu = () => {
  const [n, setN] = useState(0)

  const inc = () => setN(n + 1)

  return (
    <div>
      <h1>Menu {n}</h1>

      <button onClick={inc}>+</button>

      <ul>
        <li>Home</li>
        <li>Products</li>

        <Slots.Menu.Host n={n} inc={inc}>
          <li>Default view when no fills added</li>
        </Slots.Menu>
      </ul>
    </div>
  )
}
```

3. Create fills.

```tsx
// feature-a.tsx

import { Slots } from "./app-slots"

export const FeatureA = () => {
  const { n } = Slots.Menu.useProps()

  return (
    <Slots.Menu>
      <li>
        <button onClick={() => alert(n)}>Alert {n}</button>
      </li>
    </Slots.Menu>
  )
}
```

```tsx
// feature-b.tsx

import { useState } from "react"
import { Slots } from "./app-slots"

export const FeatureB = () => {
  const { n, inc } = Slots.Menu.useProps()

  const [inner, setInner] = useState(0)

  return (
    <Slots.Menu>
      <li>
        <b>
          B: Inc <button onClick={inc}>{n}</button>
        </b>

        <i>
          <button
            onClick={() => setInner(inner + 1)}
          >{`Inner: ${inner}`}</button>
        </i>
      </li>
    </Slots.Menu>
  )
}
```

4. Enable them

```tsx
// app.tsx

import { useState } from "react"
import { Menu } from "./menu"
import { FeatureA } from "./feature-a"
import { FeatureB } from "./feature-b"

export function App() {
  const [isOn, setIsOn] = useState(true)

  return (
    <div className={styles.root}>
      <div>
        <h1>App</h1>

        <button onClick={() => setIsOn(!isOn)}>toggle feature A</button>
      </div>

      <Menu />

      {isOn && <FeatureA />}
      <FeatureB />
    </div>
  )
}
```
