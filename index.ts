import React, { useLayoutEffect } from "react"
import {
  createDomain,
  createEvent,
  createStore,
  Event,
  Store,
  Domain,
} from "effector"
import { createGate, useGate, useUnit } from "effector-react"

type Params = {
  name?: string
  domain?: Domain
}

type FillProps = {
  children: React.ReactElement
  order?: Order
}

type Order = number
type AddPayload = { node: React.ReactElement; order: Order }
type RemovePayload = Order

type EffectorUnits<Props> = {
  add: Event<AddPayload>
  remove: Event<RemovePayload>
  props: Store<Props>
  $list: Store<Array<React.ReactElement>>
}

type Slot<P> = React.FC<FillProps> & {
  Host: React.FC<React.PropsWithChildren<P>>
  units: EffectorUnits<P>
  useProps: () => P
}

let nextSlot = 0

export function createSlot<Props>(params: Params = {}): Slot<Props> {
  const { name = `slot-${nextSlot++}`, domain = createDomain(name) } = params

  const $fills = createStore(Array<React.ReactElement>(), {
    domain,
    name: `${name}::fills`,
  })

  const add = createEvent<AddPayload>({ domain, name: `${name}::add` })
  const remove = createEvent<RemovePayload>({ domain, name: `${name}::remove` })

  $fills
    .on(add, (list, fill) => {
      list[fill.order] = fill.node
      return [...list]
    })
    .on(remove, (list, order) => {
      delete list[order]
      return [...list]
    })

  const PropsGate = createGate<Props>({
    domain,
    name: `${name}::props_gate`,
  })

  const Host: Slot<Props>["Host"] = (props) => {
    const { children, ...rest } = props

    const fills = useUnit($fills)

    useGate(PropsGate, rest as Props)

    const hasFills = fills.some(Boolean)

    if (!hasFills) {
      return children
    }

    return React.Children.map(fills, (fill, index) => {
      if (!fill) {
        return null
      }

      return React.cloneElement(fill, {
        key: fill.key ?? index,
      })
    })
  }

  let nextOrder = 0

  const Slot: Slot<Props> = (props) => {
    const { children: node, order: forcedOrder } = props

    const orderRef = React.useRef(forcedOrder)

    if (orderRef.current === undefined) {
      orderRef.current = nextOrder++
    }

    useLayoutEffect(() => {
      const order = orderRef.current as number

      add({ node, order })

      return () => {
        remove(order)
      }
    }, [node, orderRef])

    return null
  }

  Slot.Host = Host

  Slot.units = {
    add,
    remove,
    $list: $fills,
    props: PropsGate.state,
  }

  Slot.useProps = () => {
    return useUnit(PropsGate.state)
  }

  return Slot
}
