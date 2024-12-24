import * as React from "react"

type Fill = React.ReactElement

type Slot<Props> = React.FC<{
  children: React.ReactElement
  order?: number
}> & {
  Host: React.FC<React.PropsWithChildren<Props>>
}

type SlotConfig = {
  name?: string
  unmountDelay?: number
}

type SetFills = React.Dispatch<React.SetStateAction<(Fill | null)[]>>

export function createSlot<Props>(config?: SlotConfig): Slot<Props> {
  let _setFills: SetFills | null = null
  let nextKey = 0

  const SlotComponent: Slot<Props> = (props) => {
    const { children, order = nextKey++ } = props

    if (!children) {
      throw new Error("'Slot' without children rendered")
    }

    const fill: Fill = children

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

  const Host: Slot<Props>["Host"] = (props) => {
    const [fills, setFills] = React.useState<(Fill | null)[]>([])

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
