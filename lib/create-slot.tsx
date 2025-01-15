import * as React from "react"
import { createContext } from "react"

type Fill = React.ReactElement
type SetFills = React.Dispatch<React.SetStateAction<(Fill | null)[]>>
type SlotId = number
type FillKey = number

export type Slot<Props> = React.FC<{
  children: React.ReactElement
  order?: FillKey
}> & {
  Host: React.FC<React.PropsWithChildren<Props>>
  useProps(): Props
}

let nextSlotId = 0

// Used to populate the Host component on the first render.
const Registry: Record<SlotId, (Fill | null)[]> = {}

// Factory function that creates a Slot component.
export function createSlot<T>(): Slot<T> {
  let slotId = nextSlotId++
  let _setFills: SetFills | null = null
  let nextKey: FillKey = 0

  const SlotComponent: Slot<T> = ({ order, children }) => {
    const keyRef = React.useRef(order ?? nextKey++)

    if (!children) {
      throw new Error("'Slot' without children rendered")
    }

    const fill = children

    const fills = Registry[slotId] ?? []
    fills[keyRef.current] = fill
    Registry[slotId] = fills

    React.useEffect(() => {
      if (!_setFills) {
        throw new Error("`Host` does not mounted")
      }

      const key = keyRef.current
      const setter = _setFills

      setter((prev) => {
        const next = [...prev]
        next[key] = fill
        return next
      })

      return () => {
        const fills = Registry[slotId] ?? []
        fills[key] = null

        setter((prev) => {
          const next = [...prev]
          next[key] = null
          return next
        })
      }
    }, [fill])

    return null
  }

  const PropsContext = createContext(null as T)

  const Host: Slot<T>["Host"] = (props) => {
    const [fills, setFills] = React.useState([])

    React.useLayoutEffect(() => {
      if (_setFills) {
        throw new Error("Multiple 'Host' mounted")
      }

      _setFills = setFills as SetFills

      return () => {
        _setFills = null
        nextKey = 0
      }
    }, [])

    const hasFills = fills.some(Boolean)
    const registry = Registry[slotId] ?? []

    let content = props.children

    if (hasFills) {
      content = fills
    }

    if (!hasFills && registry.some(Boolean)) {
      content = registry
    }

    return (
      <PropsContext.Provider value={props}>
        {content}
      </PropsContext.Provider>
    )
  }

  SlotComponent.Host = Host
  SlotComponent.useProps = () => React.useContext(PropsContext)

  return SlotComponent
}
