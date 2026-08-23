import { CrmNav, StatusBar, useCatalog } from "crm-core"
import type { ReactNode } from "react"

/**
 * The shell's chrome. The interesting line is `StatusBar.Host`: the host of
 * the runtime channel, which is empty in the server's HTML by construction.
 */
export function Layout({
  current,
  enabled,
  toast,
  children,
}: {
  current: string
  enabled: readonly string[]
  toast: string | null
  children: ReactNode
}) {
  const catalog = useCatalog()

  return (
    <div className="crm">
      <aside className="crm__side">
        <div className="crm__brand">
          Northwind CRM
          <small>create-slot · pages router, SSR</small>
        </div>

        <div>
          <p className="side__title">Navigation</p>
          {/* Plugin nav items are in the HTML the server sent. */}
          <CrmNav current={current} />
        </div>

        <div>
          <p className="side__title">Enabled by the server</p>
          <div className="chips">
            {catalog.map((plugin) => (
              <label
                key={plugin.id}
                className="chip"
                data-plugin={plugin.id}
                title={plugin.description}
              >
                <input
                  type="checkbox"
                  checked={enabled.includes(plugin.id)}
                  readOnly
                  disabled
                />
                {plugin.id}
              </label>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            A server decision, not a client one. Try{" "}
            <code>?plugins=pipeline,email</code>.
          </p>
        </div>
      </aside>

      <div className="crm__main">
        <div className="crm__bar">
          <strong>Status</strong>
          <StatusBar.Host>
            <span>
              placeholder — view source and this is what the server shipped
            </span>
          </StatusBar.Host>
        </div>

        <div className="crm__content">{children}</div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
