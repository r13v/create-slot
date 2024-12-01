import * as React from "react"

type FillStatus = "entered" | "ended"

type Fill = React.ReactElement & { status: FillStatus }

type Slot<Props> = React.FC<{ children: React.ReactElement }> & {
  Host: React.FC<Props>
  useProps(): Props
  useStatus(): FillStatus
}

type SlotConfig = {
  name?: string
  unmountDelay?: number
}

type SetFills = React.Dispatch<React.SetStateAction<(Fill | null)[]>>

export function createSlot<Props extends React.PropsWithChildren>(
  config?: SlotConfig,
): Slot<Props> {
  let _setFills: SetFills | null = null
  let nextKey = 0

  const PropsContext = React.createContext<Props | null>(null)
  const StatusContext = React.createContext<FillStatus>("entered")

  const SlotComponent: Slot<Props> = (props) => {
    const { children } = props

    if (!children) {
      throw new Error("'Slot' without children rendered")
    }

    const keyRef = React.useRef(nextKey++)

    const fill: Fill = Object.assign(children, { status: "entered" as const })

    React.useEffect(() => {
      if (!_setFills) {
        throw new Error("`Host` does not mounted")
      }

      const key = keyRef.current

      _setFills((prev) => {
        const next = [...prev]
        next[key] = fill

        return next
      })

      return () => {
        if (!_setFills) {
          throw new Error("`Host` does not mounted")
        }

        _setFills((prev) => {
          const next = [...prev]
          const fill = next[key]

          if (!fill) {
            throw new Error(`Fill #${key} does not exists`)
          }

          fill.status = "ended"

          return next
        })

        setTimeout(() => {
          if (!_setFills) {
            throw new Error("`Host` does not mounted")
          }

          _setFills((prev) => {
            const next = [...prev]
            next[key] = null

            return next
          })
        }, config?.unmountDelay ?? 0)
      }
    }, [fill])

    return null
  }

  const Host: Slot<Props>["Host"] = (props) => {
    const [fills, setFills] = React.useState<(Fill | null)[]>([])

    React.useEffect(() => {
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

    if (!hasFills) {
      return props.children
    }

    return <PropsContext.Provider value={props}>{fills}</PropsContext.Provider>
  }

  SlotComponent.Host = Host

  SlotComponent.useProps = () => {
    const value = React.useContext(PropsContext)

    if (!value) {
      throw new Error("'useProps' value is not exists")
    }

    return value
  }

  SlotComponent.useStatus = () => {
    const value = React.useContext(StatusContext)

    if (!value) {
      throw new Error("'useStatus' value is not exists")
    }

    return value
  }

  if (config?.name) {
    SlotComponent.displayName = config.name
    SlotComponent.Host.displayName = `${config.name}__Host`
  }

  return SlotComponent
}
