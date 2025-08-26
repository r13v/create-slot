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
  const setters = new Setters()
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

    const updateFill = React.useCallback(() => {
      const key = keyRef.current

      setters.forEach((setter) => {
        setter((prev) => {
          const next = [...prev]
          next[key] = fill
          return next
        })
      })

      return () => {
        setters.forEach((setter) => {
          setter((prev) => {
            const next = [...prev]
            next[key] = null
            return next
          })
        })
      }
    }, [fill])

    React.useEffect(() => {
      return updateFill()
    }, [updateFill])

    React.useEffect(() => {
      return setters.subscribe(() => {
        updateFill()
      })
    }, [updateFill])

    return null
  }

  const PropsContext = React.createContext(null as T)

  const Host: Slot<T>["Host"] = (props) => {
    const [fills, setFills] = React.useState<(Fill | null)[]>([])

    React.useLayoutEffect(() => {
      setters.add(setFills)

      return () => {
        setters.remove(setFills)

        if (setters.isEmpty()) {
          nextKey = 0
        }
      }
    }, [])

    const hasFills = fills.some(Boolean)

    const content = hasFills ? fills.filter(Boolean) : props.children

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

class Setters {
  private setters: SetFills[] = []
  private subscribers: (() => void)[] = []

  forEach(callback: (setter: SetFills) => void) {
    for (const setter of this.setters) {
      callback(setter)
    }
  }

  isEmpty() {
    return this.setters.length === 0
  }

  add(setter: SetFills) {
    this.setters.push(setter)
    this.notify()
  }

  remove(setter: SetFills) {
    this.setters = this.setters.filter((s) => s !== setter)
    this.notify()
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.push(callback)

    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback)
    }
  }

  notify() {
    for (const subscriber of this.subscribers) {
      subscriber()
    }
  }
}
