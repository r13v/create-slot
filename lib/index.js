import * as React from "react"

/**
 * `createSlot` is a factory function that creates a Slot component.
 * @template Props
 * @param {import('./index.js').SlotConfig} [config]
 * @returns {import('./index.js').Slot<Props>}
 */
export function createSlot(config) {
  /** @type {import('./index.js').SetFills | null} */
  let _setFills = null
  let nextKey = 0

  /**
   * @type {import('./index.js').Slot<Props>}
   */
  const SlotComponent = (props) => {
    const { children, order = nextKey++ } = props

    if (!children) {
      throw new Error("'Slot' without children rendered")
    }

    /** @type {import('./index.js').Fill} */
    const fill = children

    React.useEffect(() => {
      if (!_setFills) {
        throw new Error("`Host` does not mounted")
      }

      const key = order
      const setter = _setFills

      setter((prev) => {
        const next = [...prev]
        next[key] = fill
        return next
      })

      const unmount = () => {
        setter((prev) => {
          const next = [...prev]
          next[key] = null
          return next
        })
      }

      return () => {
        if (!config?.unmountDelay) {
          return unmount()
        }
        setTimeout(unmount, config?.unmountDelay)
      }
    }, [fill, order])

    return null
  }

  /**
   * @type {import('./index.js').Slot<Props>["Host"]}
   */
  const Host = (props) => {
    const [fills, setFills] = React.useState(
      /** @type {(import('./index.js').Fill | null)[]} */ [],
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

    const hasFallback =
      props &&
      typeof props === "object" &&
      "children" in props &&
      React.isValidElement(props.children)

    const defaultFill = hasFallback ? props.children : null

    return hasFills ? fills : defaultFill
  }

  SlotComponent.Host = Host

  if (config?.name) {
    SlotComponent.displayName = config.name
    SlotComponent.Host.displayName = `${config.name}__Host`
  }

  return SlotComponent
}
