// @ts-check
import * as React from "react"
import { createContext } from "react"

/**
 * `createSlot` is a factory function that creates a Slot component.
 * @template Props
 * @returns {import('./index.jsx').Slot<Props>}
 */
export function createSlot() {
  /** @type {import('./index.jsx').SetFills | null} */
  let _setFills = null
  let nextKey = 0

  /**
   * @type {import('./index.jsx').Slot<Props>}
   */
  const SlotComponent = ({ order, children }) => {
    const keyRef = React.useRef(order ?? nextKey++)

    if (!children) {
      throw new Error("'Slot' without children rendered")
    }

    /** @type {import('./index.jsx').Fill} */
    const fill = children

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
        setter((prev) => {
          const next = [...prev]
          next[key] = null
          return next
        })
      }
    }, [fill])

    return null
  }

  /** @type {(import('./index.jsx').PropsContext<Props>)} */
  const PropsContext = createContext(null)

  /**
   * @type {import('./index.jsx').Slot<Props>["Host"]}
   */
  const Host = (props) => {
    const [fills, setFills] = React.useState(
      /** @type {(import('./index.jsx').Fill | null)[]} */ [],
    )

    React.useLayoutEffect(() => {
      if (_setFills) {
        throw new Error("Multiple 'Host' mounted")
      }

      _setFills = setFills

      return () => {
        _setFills = null
        nextKey = 0
      }
    }, [])

    const hasFills = fills.some(Boolean)

    return (
      <PropsContext.Provider value={props}>
        {hasFills ? fills : props.children}
      </PropsContext.Provider>
    )
  }

  SlotComponent.Host = Host
  SlotComponent.useProps = () => React.useContext(PropsContext)

  return SlotComponent
}
