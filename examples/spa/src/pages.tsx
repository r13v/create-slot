import { isClosed, money, STALE_AFTER_DAYS, weighted } from "crm-core/data"

import { useCrm } from "./crm"
import {
  DashboardWidgets,
  DealActions,
  DealPanels,
  SettingsSections,
  StatusBar,
} from "./slots"
import { Button, Card, Link, StageTag } from "./ui"

/**
 * The four pages.
 *
 * They are hosts and nothing else: each one decides where contributions land
 * and what shows while there are none — its host's children are the
 * placeholder.
 */

export function Page({ path }: { path: string }) {
  if (path === "/") {
    return <DashboardPage />
  }

  if (path === "/deals") {
    return <DealsPage />
  }

  if (path.startsWith("/deals/")) {
    return <DealPage id={path.slice("/deals/".length)} />
  }

  if (path === "/settings") {
    return <SettingsPage />
  }

  return (
    <Card title="Not found">
      <p className="muted">No page at {path}.</p>
    </Card>
  )
}

function DashboardPage() {
  const { deals } = useCrm()
  const open = deals.filter((deal) => !isClosed(deal))

  return (
    <>
      {/*
        A fill from the page itself. Plugins have no privileged channel: this is
        the same component the plugins use, mounted from the page that happens
        to be on screen.
      */}
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

        <DashboardWidgets.Host>
          <Card title="No widgets" hint="nothing is contributed">
            <p className="muted">
              Every card but the first one is a fill. Unmount a plugin in the
              sidebar and its cards leave with it.
            </p>
          </Card>
        </DashboardWidgets.Host>
      </div>
    </>
  )
}

function DealsPage() {
  const { deals } = useCrm()

  return (
    <>
      <StatusBar>
        <span>
          All deals · {deals.length} records · {money(weighted(deals))} weighted
        </span>
      </StatusBar>

      <Card title="All deals" wide>
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Owner</th>
              <th>Stage</th>
              <th className="right">Amount</th>
              <th>
                Actions <span className="muted">one host per row</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
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
                  {/* The same fills, once per row, each with its own props. */}
                  <div className="actions">
                    <DealActions.Host deal={deal} scope="row">
                      <span className="muted">no actions</span>
                    </DealActions.Host>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

function DealPage({ id }: { id: string }) {
  const { deals, notify } = useCrm()
  const deal = deals.find((it) => it.id === id)

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
          Deals / {deal.company} · {money(deal.amount)} ·{" "}
          {deal.idleDays >= STALE_AFTER_DAYS
            ? `idle ${deal.idleDays} days`
            : "active"}
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

        {/* The same slot as every table row, in a host with other props. */}
        <div className="actions">
          <DealActions.Host deal={deal} scope="detail" />
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
          <Button onClick={() => notify(`Logged a note on ${deal.company}`)}>
            Log a note
          </Button>
        </Card>

        <DealPanels.Host deal={deal} />
      </div>
    </>
  )
}

function SettingsPage() {
  return (
    <>
      <StatusBar>
        <span>Settings</span>
      </StatusBar>

      <div className="grid">
        <SettingsSections.Host>
          <Card title="No settings">
            <p className="muted">
              No mounted plugin has anything to configure.
            </p>
          </Card>
        </SettingsSections.Host>

        <Card title="What is installed" hint="nothing to enumerate" wide>
          <p className="muted">
            There is no manifest and no plugin array to read here: the app
            mounts its plugins as children, so what is installed is the JSX in{" "}
            <code>src/app.tsx</code>, and what is enabled is which branches of
            it render.
          </p>

          <pre className="code">{INSTALLED}</pre>
        </Card>
      </div>
    </>
  )
}

const INSTALLED = `<AppShell>
  <Switchboard … />
  {on("pipeline") && <PipelinePlugin />}
  {on("forecast") && <ForecastPlugin />}
  {on("telephony") && <TelephonyPlugin />}
  {on("faulty") && <CrashTestPlugin />}
</AppShell>`
