import type { ReactNode } from "react"

import { CrmProvider, useCrm } from "./crm"
import { Page } from "./pages"
import { NavItems, PluginSwitches, StatusBar } from "./slots"
import { Card, Link } from "./ui"
import { useLocation } from "./use-location"

/**
 * The shell: navigation, routing, the status bar, and the hosts everything else
 * renders into.
 *
 * Its `children` are the plugins. They render nothing where they are mounted —
 * each one is a set of fills — so mounting one is the whole of installing it,
 * and unmounting it is the whole of removing it.
 */
export function AppShell({ children }: { children?: ReactNode }) {
  const { href, navigate } = useLocation()

  return (
    <CrmProvider navigate={navigate}>
      {/*
        The plugins, and the app's own switchboard. Order here is irrelevant:
        a fill's place in a host comes from its `order`, not from where it is
        mounted.
      */}
      {children}

      <Layout path={href} />
    </CrmProvider>
  )
}

function Layout({ path }: { path: string }) {
  const { log } = useCrm()

  return (
    <div className="crm">
      <aside className="crm__side">
        <div className="crm__brand">
          Northwind CRM
          <small>create-slot · plugins as children</small>
        </div>

        <div>
          <p className="side__title">Navigation</p>

          <nav className="nav">
            <ul className="stack">
              <li className="row">
                <Link href="/" current={path === "/"}>
                  Dashboard
                </Link>
              </li>
              <li className="row">
                <Link href="/deals" current={path === "/deals"}>
                  Deals
                </Link>
              </li>
              <li className="row">
                <Link href="/settings" current={path === "/settings"}>
                  Settings
                </Link>
              </li>

              {/* Plugin links land under the shell's own, ranked by `order`. */}
              <NavItems.Host current={path} />
            </ul>
          </nav>
        </div>

        <div>
          <p className="side__title">Plugins</p>

          <div className="chips">
            <PluginSwitches.Host>
              <span className="muted">nothing mounted</span>
            </PluginSwitches.Host>
          </div>
        </div>
      </aside>

      <div className="crm__main">
        <div className="crm__bar">
          <strong>Status</strong>

          {/*
            Whatever is mounted registers its own summary here — the page, and
            a plugin while it has something to say. Both are fills, so both
            rank on `order` in the same host.
          */}
          <StatusBar.Host>
            <span>nothing has registered a summary yet</span>
          </StatusBar.Host>
        </div>

        <div className="crm__content">
          <Page path={path} />

          <Card
            title="Activity"
            hint="notify() from the shell and its plugins"
            wide
          >
            {log.length === 0 ? (
              <p className="muted">
                Nothing yet — advance a deal, or place a call from the deals
                table.
              </p>
            ) : (
              <ul className="log">
                {log.map((entry) => (
                  <li key={entry.id}>{entry.text}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
