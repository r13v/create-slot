import React, { useState, useEffect } from "react"

export interface PrivateCallContext<Props, Response> {
  key: string
  props: Props
  end: (response: Response) => void
  ended: boolean
}
export type PrivateStackState<Props, Response> = PrivateCallContext<
  Props,
  Response
>[]
export type PrivateStackStateSetter<Props, Response> = React.Dispatch<
  React.SetStateAction<PrivateStackState<Props, Response>>
>

/**
 * The call() method
 */
export type CallFunction<Props, Response> = (props: Props) => Promise<Response>

/**
 * The special call prop in UserComponent
 */
export type CallContext<Props, Response, RootProps> = Omit<
  PrivateCallContext<Props, Response>,
  "props"
> & { root: RootProps; stack: { index: number; size: number } }

/**
 * User props + the call prop
 */
export type PropsWithCall<Props, Response, RootProps> = Props & {
  call: CallContext<Props, Response, RootProps>
}

/**
 * What is passed to createCallable
 */
export type UserComponentType<Props, Response, RootProps> =
  React.FunctionComponent<PropsWithCall<Props, Response, RootProps>>

/**
 * What createCallable returns
 */
export type Callable<Props, Response, RootProps> = {
  Root: React.FunctionComponent<RootProps>
  call: CallFunction<Props, Response>
}

export function createCallable<Props = void, Response = void, RootProps = {}>(
  UserComponent: UserComponentType<Props, Response, RootProps>,
  unmountingDelay = 0,
): Callable<Props, Response, RootProps> {
  let $setStack: PrivateStackStateSetter<Props, Response> | null = null
  let $nextKey = 0

  return {
    call: (props) => {
      if (!$setStack) throw new Error("No <Root> found!")

      const key = String($nextKey++)
      let resolve: (value: Response | PromiseLike<Response>) => void
      const promise = new Promise<Response>((res) => {
        resolve = res
      })

      const end = (response: Response) => {
        resolve(response)
        if (!$setStack) return
        const scopedSetStack = $setStack

        if (unmountingDelay > 0) {
          scopedSetStack((prev) =>
            prev.map((c) => (c.key !== key ? c : { ...c, ended: true })),
          )
        }

        globalThis.setTimeout(
          () => scopedSetStack((prev) => prev.filter((c) => c.key !== key)),
          unmountingDelay,
        )
      }

      $setStack((prev) => [...prev, { key, props, end, ended: false }])
      return promise
    },
    Root: (rootProps: RootProps) => {
      const [stack, setStack] = useState<PrivateStackState<Props, Response>>([])

      useEffect(() => {
        if ($setStack) throw new Error("Multiple instances of <Root> found!")
        $setStack = setStack
        return () => {
          $setStack = null
          $nextKey = 0
        }
      }, [])

      return stack.map(({ props, ...call }, index) => (
        <UserComponent
          {...props}
          key={call.key}
          call={{
            ...call,
            root: rootProps,
            stack: { index, size: stack.length },
          }}
        />
      ))
    },
  }
}
