import { useCallback, useEffect, useState } from "react"

/** The whole router, so the example does not need one. */
export function useLocation() {
  const [href, setHref] = useState(read)

  useEffect(() => {
    const onPopState = () => setHref(read())

    window.addEventListener("popstate", onPopState)

    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const navigate = useCallback((next: string) => {
    if (next === read()) {
      return
    }

    window.history.pushState(null, "", next)
    setHref(next)
  }, [])

  return { href, navigate }
}

function read(): string {
  return window.location.pathname
}
