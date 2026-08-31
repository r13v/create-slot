import { SlotHost } from "create-slot"

import { describeCatalog } from "./catalog"
import { isClosed, money, weighted } from "./data"
import {
  useCatalog,
  useCommands,
  useCrmApi,
  useDealViews,
  useViewConflicts,
} from "./runtime"
import {
  DashboardWidgets,
  DealActions,
  DealPanels,
  NavItems,
  SettingsSections,
} from "./slots"
import { useDeal, useDeals } from "./state"
import { StatusBar } from "./status-bar"
import { Button, Card, Link, StageTag } from "./ui"

/**
 * The four pages, shared by both examples.
 *
 * Nothing in here knows whether it is running in a SPA or being rendered by a
 * server: the pages use hosts, and the shell around them wires up routing,
 * state and — in the Next.js example — the request.
 */

export function DashboardPage() {
  const deals = useDeals()
  const open = deals.filter((deal) => !isClosed(deal))
  const commands = useCommands()

  return (
    <>
      <StatusBar>
        <span>
          Dashboard · {open.length} open deals · {money(weighted(open))}{" "}
          weighted
        </span>
      </StatusBar>

      <div className="grid">
        <Card title="Open pipeline" hint="the shell's own card">
          <p className="kpi">
            {money(open.reduce((total, deal) => total + deal.amount, 0))}{" "}
            <small>across {open.length} deals</small>
          </p>
        </Card>

        <SlotHost slot={DashboardWidgets}>
          <Card title="No widgets" hint="nothing is contributed">
            <p className="muted">
              Every card but the first one is a contribution. Turn a plugin off
              and it leaves with the plugin.
            </p>
          </Card>
        </SlotHost>

        <Card title="Commands" hint="from setup(), never rendered">
          {commands.length === 0 ? (
            <p className="muted">
              No commands. `setup` runs in an effect, so these are client-only
              by construction — view the source of a server-rendered page and
              this list is empty there.
            </p>
          ) : (
            <ul className="stack">
              {commands.map((command) => (
                <li key={command.id} className="row">
                  <span>{command.title}</span>
                  <Button onClick={command.run}>run</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

export function DealsPage({ view }: { view?: string }) {
  const deals = useDeals()
  const views = useDealViews()
  const conflicts = useViewConflicts()

  const active = view ? views.get(view) : undefined
  const shown = active ? deals.filter((deal) => active.match(deal)) : deals

  return (
    <>
      <StatusBar>
        <span>
          {active ? active.title : "All deals"} · {shown.length} of{" "}
          {deals.length} · {money(weighted(shown))} weighted
        </span>
      </StatusBar>

      <Card
        title={active ? active.title : "All deals"}
        hint={active ? `saved view from ${active.pluginId}` : undefined}
        wide
      >
        {view && !active && (
          <p className="notice">
            No plugin owns the view “{view}”. Its owner is probably switched
            off.
          </p>
        )}

        {conflicts.map((conflict) => (
          <p key={conflict} className="notice">
            {conflict}
          </p>
        ))}

        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Owner</th>
              <th>Stage</th>
              <th className="right">Amount</th>
              <th>
                Actions <span className="muted">crm:deal-actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((deal) => (
              <tr key={deal.id}>
                <td>
                  <Link href={`/deals/${deal.id}`}>{deal.company}</Link>
                </td>
                <td className="muted">{deal.owner}</td>
                <td>
                  <StageTag stage={deal.stage} />
                </td>
                <td className="right">{money(deal.amount)}</td>
                <td>
                  {/* One host per row: the same contributions, different props. */}
                  <div className="actions">
                    <SlotHost slot={DealActions} props={{ deal, scope: "row" }}>
                      <span className="muted">no actions</span>
                    </SlotHost>
                  </div>
                </td>
              </tr>
            ))}

            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nothing matches this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  )
}

export function DealPage({ id }: { id: string }) {
  const deal = useDeal(id)
  const api = useCrmApi()

  if (!deal) {
    return (
      <Card title="Unknown deal">
        <p className="muted">
          Nothing here with the id “{id}”.{" "}
          <Link href="/deals">Back to all deals</Link>
        </p>
      </Card>
    )
  }

  return (
    <>
      <StatusBar>
        <span>
          Deals / {deal.company} · {money(deal.amount)}
        </span>
      </StatusBar>

      <header className="deal">
        <div>
          <h1>{deal.company}</h1>
          <p className="muted">
            <StageTag stage={deal.stage} /> · {money(deal.amount)} ·{" "}
            {deal.owner}
          </p>
        </div>

        {/* The same slot as every list row, in a host with other props. */}
        <div className="actions">
          <SlotHost slot={DealActions} props={{ deal, scope: "detail" }} />
        </div>
      </header>

      <div className="grid">
        <Card title="Contact" hint="the shell's own card">
          <p>
            <strong>{deal.contact.name}</strong>
            <br />
            {deal.contact.email}
            <br />
            {deal.contact.phone}
          </p>
          <Button
            onClick={() => api.notify(`Logged a note on ${deal.company}`)}
          >
            Log a note
          </Button>
        </Card>

        <SlotHost slot={DealPanels} props={{ deal }} />
      </div>
    </>
  )
}

export function SettingsPage() {
  const inventory = describeCatalog(useCatalog())

  return (
    <>
      <StatusBar>
        <span>Settings · {inventory.length} plugins installed</span>
      </StatusBar>

      <div className="grid">
        <SlotHost slot={SettingsSections}>
          <Card title="No settings">
            <p className="muted">
              No enabled plugin has anything to configure.
            </p>
          </Card>
        </SlotHost>

        <Card title="Installed plugins" hint="the manifest, read as data" wide>
          <table className="table">
            <thead>
              <tr>
                <th>Plugin</th>
                <th>Slots</th>
                <th>State</th>
                <th>Saved views</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((plugin) => (
                <tr key={plugin.id}>
                  <td>
                    <strong>{plugin.title}</strong>
                    <p className="muted">{plugin.description}</p>
                  </td>
                  <td>
                    <div className="pills">
                      {plugin.slots.map((slot) => (
                        <span key={slot} className="pill">
                          {slot}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="muted">{plugin.state}</td>
                  <td className="muted">{plugin.views.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}

/** The shell's navigation, shared because both examples want the same links. */
export function CrmNav({ current }: { current: string }) {
  return (
    <nav className="nav">
      <ul className="stack">
        <li className="row">
          <Link href="/" current={current === "/"}>
            Dashboard
          </Link>
        </li>
        <li className="row">
          <Link href="/deals" current={current === "/deals"}>
            Deals
          </Link>
        </li>
        <li className="row">
          <Link href="/settings" current={current === "/settings"}>
            Settings
          </Link>
        </li>

        {/* Plugin links land under the shell's own, ranked by `order`. */}
        <SlotHost slot={NavItems} props={{ current }} />
      </ul>
    </nav>
  )
}
