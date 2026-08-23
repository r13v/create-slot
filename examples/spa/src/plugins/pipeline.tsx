import {
  isClosed,
  money,
  nextStage,
  STAGES,
  STALE_AFTER_DAYS,
} from "crm-core/data"
import { useState } from "react"

import { useCrm } from "../crm"
import {
  DashboardWidgets,
  DealActions,
  DealPanels,
  NavItems,
  SettingsSections,
} from "../slots"
import { Button, Link, PluginCard, PluginRow, StageTag } from "../ui"

const ID = "pipeline"

/**
 * Five contributions from one component, and the plugin's own state behind
 * them.
 *
 * `confirm` needs no store: the elements are created here, so the value goes
 * into them as an ordinary prop, and every host re-renders when it changes.
 */
export function PipelinePlugin() {
  const [confirm, setConfirm] = useState(true)

  return (
    <>
      <NavItems order={10}>
        <StalledLink />
      </NavItems>

      <DashboardWidgets order={10}>
        <PipelineWidget />
      </DashboardWidgets>

      <DealActions order={10}>
        <AdvanceAction confirm={confirm} />
      </DealActions>

      <DealPanels order={10}>
        <NextStepPanel />
      </DealPanels>

      <SettingsSections order={10}>
        <PipelineSettings confirm={confirm} onChange={setConfirm} />
      </SettingsSections>
    </>
  )
}

function StalledLink() {
  // The host's props, read where this renders — not where it was written.
  const { current } = NavItems.useProps()
  const { deals } = useCrm()

  const stalled = deals.filter(
    (deal) => !isClosed(deal) && deal.idleDays >= STALE_AFTER_DAYS,
  )

  return (
    <PluginRow plugin={ID}>
      <Link href="/deals" current={current === "/deals"}>
        Stalled deals
      </Link>{" "}
      <span className="muted">{stalled.length}</span>
    </PluginRow>
  )
}

const TARGET = 600000

function PipelineWidget() {
  const { deals } = useCrm()
  const open = deals.filter((deal) => !isClosed(deal))
  const total = open.reduce((sum, deal) => sum + deal.amount, 0)
  const share = Math.min(100, Math.round((total / TARGET) * 100))

  return (
    <PluginCard plugin={ID} title="Pipeline">
      <p className="muted">
        {money(total)} of {money(TARGET)} target
      </p>

      <div className="meter" role="img" aria-label={`${share}% of target`}>
        <span style={{ width: `${share}%` }} />
      </div>

      <ul className="bars">
        {STAGES.map((stage) => (
          <li key={stage}>
            <StageTag stage={stage} />
            <span className="muted">
              {deals.filter((deal) => deal.stage === stage).length}
            </span>
          </li>
        ))}
      </ul>
    </PluginCard>
  )
}

function AdvanceAction({ confirm }: { confirm: boolean }) {
  const { deal, scope } = DealActions.useProps()
  const { advance, notify } = useCrm()
  const [armed, setArmed] = useState(false)

  if (isClosed(deal)) {
    return scope === "detail" ? <span className="muted">closed</span> : null
  }

  const next = nextStage(deal.stage)

  const run = () => {
    if (confirm && !armed) {
      setArmed(true)

      return
    }

    setArmed(false)
    advance(deal.id)
    notify(`${deal.company} → ${next}`)
  }

  // The same fill in seven table rows and on the detail page: `scope` is how it
  // tells the hosts apart.
  return (
    <Button tone={scope === "detail" ? "primary" : undefined} onClick={run}>
      {armed ? "Sure?" : scope === "detail" ? `Advance to ${next}` : "Advance"}
    </Button>
  )
}

function NextStepPanel() {
  const { deal } = DealPanels.useProps()

  return (
    <PluginCard plugin={ID} title="Next step">
      {isClosed(deal) ? (
        <p className="muted">Closed — nothing to do.</p>
      ) : (
        <p>
          Move to <StageTag stage={nextStage(deal.stage)} />
        </p>
      )}

      <p className="muted">
        Last activity {deal.idleDays} days ago
        {deal.idleDays >= STALE_AFTER_DAYS ? " — stalled" : ""}.
      </p>
    </PluginCard>
  )
}

function PipelineSettings({
  confirm,
  onChange,
}: {
  confirm: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <PluginCard plugin={ID} title="Pipeline settings">
      <label className="field">
        <span>Ask before advancing a deal</span>
        <input
          type="checkbox"
          checked={confirm}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>

      <p className="muted">
        One piece of state, set on this page and read by a contribution on
        another one. It lives in the plugin component, where both elements were
        created.
      </p>
    </PluginCard>
  )
}
