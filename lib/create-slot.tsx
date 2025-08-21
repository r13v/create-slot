import * as React from "react"

type Fill = React.ReactElement
type SetFills = React.Dispatch<React.SetStateAction<(Fill | null)[]>>
type FillKey = number

export type Slot<Props> = React.FC<{
  children: React.ReactElement
  order?: FillKey
}> & {
  Host: React.FC<React.PropsWithChildren<Props>>
  useProps(): Props
}

// Factory function that creates a Slot component.
export function createSlot<T>(): Slot<T> {
  let setters: SetFills[] = []
  let nextKey: FillKey = 0

  const SlotComponent: Slot<T> = ({ order, children }) => {
    const keyRef = React.useRef(order ?? nextKey++)

    if (!children) {
      throw new Error("'Slot' without children rendered")
    }

    const fill = React.useMemo(
      () =>
        React.cloneElement(children, {
          key: keyRef.current,
        }),
      [children],
    )

    React.useEffect(() => {
      if (!setters.length) {
        throw new Error("`Host` is not mounted")
      }

      const key = keyRef.current

      for (const setter of setters) {
        setter((prev) => {
          const next = [...prev]
          next[key] = fill
          return next
        })
      }

      return () => {
        for (const setter of setters) {
          setter((prev) => {
            const next = [...prev]
            next[key] = null
            return next
          })
        }
      }
    }, [fill])

    return null
  }

  const PropsContext = React.createContext(null as T)

  const Host: Slot<T>["Host"] = (props) => {
    const [fills, setFills] = React.useState<(Fill | null)[]>([])

    React.useLayoutEffect(() => {
      setters.push(setFills)

      return () => {
        setters = setters.filter((setter) => setter !== setFills)

        if (setters.length === 0) {
          nextKey = 0
        }
      }
    }, [])

    const hasFills = fills.some(Boolean)

    let content: React.ReactNode = props.children

    if (hasFills) {
      content = fills.filter(Boolean)
    }

    return (
      <PropsContext.Provider value={props as T}>
        {content}
      </PropsContext.Provider>
    )
  }

  SlotComponent.Host = Host
  SlotComponent.useProps = () => React.useContext(PropsContext)

  return SlotComponent
}
