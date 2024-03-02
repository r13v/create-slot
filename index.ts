import React, {useLayoutEffect} from "react"
import {
    createDomain,
    createEvent,
    createStore,
    Event,
    Store,
    Domain,
} from "effector"
import {createGate, useGate, useUnit} from "effector-react"

// Types

type Params = {
    name?: string
    domain?: Domain
}

type FillProps = {
    children: React.ReactElement
    order?: Order
}

type Order = number

type FillPayload = { node: React.ReactElement; order: Order }

type RemovePayload = Order

type EffectorUnits<Props> = {
    add: Event<FillPayload>
    remove: Event<RemovePayload>
    set: Event<FillPayload>
    $props: Store<Props>
    $list: Store<Array<React.ReactElement>>
}

type Slot<P> = React.FC<FillProps> & {
    Host: React.FC<React.PropsWithChildren<P>>
    units: EffectorUnits<P>
    useProps: () => P
}

// Used for generating unique keys for slots names
let nextSlot = 0

export function createSlot<Props>(params: Params = {}): Slot<Props> {
    const {name = `slot-${nextSlot++}`, domain = createDomain(name)} = params

    // stores fills
    const $fills = createStore(Array<React.ReactElement>(), {
        domain,
        name: `${name}::fills`,
    })

    // events for fills
    const add = createEvent<FillPayload>({domain, name: `${name}::add`})
    const set = createEvent<FillPayload>({domain, name: `${name}::set`})
    const remove = createEvent<RemovePayload>({domain, name: `${name}::remove`})

    // reducer for fills
    $fills
        .on(add, (list, fill) => {
            list[fill.order] = fill.node
            return [...list]
        })
        .on(remove, (list, order) => {
            delete list[order]
            return [...list]
        })
        .on(set, (_, fill) => [fill.node])

    // Gate for passing props to the slot
    const PropsGate = createGate<Props>({
        domain,
        name: `${name}::props_gate`,
    })

    // Host component used for rendering fills
    const Host: Slot<Props>["Host"] = (props) => {
        const {children, ...rest} = props

        const fills = useUnit($fills)

        // Pass props to the gate
        useGate(PropsGate, rest as Props)

        const hasFills = fills.some(Boolean)

        // If there are no fills, render the default children
        if (!hasFills) {
            return children
        }

        // Render fills
        return React.Children.map(fills, (fill, index) => {
            if (!fill) {
                return null
            }

            return React.cloneElement(fill, {
                key: fill.key ?? index,
            })
        })
    }

    // Used to keep track of the order of fills
    let nextOrder = 0

    // Slot component used for filling the slot
    const Slot: Slot<Props> = (props) => {
        const {children: node, order: forcedOrder} = props

        const orderRef = React.useRef(forcedOrder)

        // If the order is not forced, generate a new order
        if (orderRef.current === undefined) {
            orderRef.current = nextOrder++
        }

        // Add fill to the slot on mount and remove on unmount
        useLayoutEffect(() => {
            const order = orderRef.current as number

            add({node, order})

            return () => {
                remove(order)
            }
        }, [node, orderRef])

        return null
    }

    // Expose host component, hooks and units
    Slot.Host = Host

    Slot.useProps = () => {
        return useUnit(PropsGate.state)
    }

    Slot.units = {
        add,
        remove,
        set,
        $list: $fills,
        $props: PropsGate.state,
    }

    return Slot
}
