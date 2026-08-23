import { DEALS, type Deal, nextStage } from "crm-core/data"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

/**
 * The application's own state, and everything it lends the code below it.
 *
 * `create-slot` knows nothing about any of this. A fill's element is created
 * inside a plugin but rendered inside a host, so it reads context from the
 * host's position in the tree — and both sit under this provider, which is why
 * a contribution can simply call `useCrm()`.
 */

export type LogEntry = { id: number; text: string }

export type Crm = {
  deals: readonly Deal[]
  /** The shell owns the records; plugins act on them. */
  advance: (id: string) => void
  navigate: (href: string) => void
  notify: (message: string) => void
  log: readonly LogEntry[]
}

const CrmContext = createContext<Crm | null>(null)

export function useCrm(): Crm {
  const crm = useContext(CrmContext)

  if (!crm) {
    throw new Error("[crm] 'useCrm' called outside of 'CrmProvider'")
  }

  return crm
}

/** Entries are prepended, so their position is not an identity. */
let nextLogId = 0

export function CrmProvider({
  navigate,
  children,
}: {
  navigate: (href: string) => void
  children: ReactNode
}) {
  const [deals, setDeals] = useState<readonly Deal[]>(DEALS)
  const [log, setLog] = useState<readonly LogEntry[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const notify = useCallback((text: string) => {
    setToast(text)
    setLog((prev) => [{ id: nextLogId++, text }, ...prev].slice(0, 6))
  }, [])

  const advance = useCallback((id: string) => {
    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === id ? { ...deal, stage: nextStage(deal.stage) } : deal,
      ),
    )
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = setTimeout(() => setToast(null), 2400)

    return () => clearTimeout(timer)
  }, [toast])

  const crm = useMemo<Crm>(
    () => ({ deals, advance, navigate, notify, log }),
    [deals, advance, navigate, notify, log],
  )

  return (
    <CrmContext.Provider value={crm}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </CrmContext.Provider>
  )
}
