import { Component, type ErrorInfo, type ReactNode, useState } from "react"

import { useCrm } from "../crm"
import { DashboardWidgets } from "../slots"
import { Button, PluginCard } from "../ui"

const ID = "faulty"

/**
 * What a broken contribution costs, and who pays for it.
 *
 * Nothing wraps a fill: it is the plugin's own element in the app's own tree,
 * so an error in it takes down the host that rendered it. Isolation is a
 * boundary the plugin puts around the contribution it knows can throw — which
 * is what the declarative channel does on its own, per contribution, and why
 * the Next.js examples get it for free.
 */
export function CrashTestPlugin() {
  const [broken, setBroken] = useState(false)

  return (
    <>
      <DashboardWidgets order={90}>
        <Detonator onBreak={() => setBroken(true)} />
      </DashboardWidgets>

      <DashboardWidgets order={91}>
        <Boundary onReset={() => setBroken(false)}>
          <Fragile broken={broken} />
        </Boundary>
      </DashboardWidgets>
    </>
  )
}

function Detonator({ onBreak }: { onBreak: () => void }) {
  return (
    <PluginCard plugin={ID} title="Crash test">
      <p className="muted">
        Two contributions from one plugin. Only the second one throws.
      </p>
      <Button tone="danger" onClick={onBreak}>
        Break the next card
      </Button>
    </PluginCard>
  )
}

function Fragile({ broken }: { broken: boolean }) {
  if (broken) {
    throw new Error("faulty: this contribution exploded during render")
  }

  return (
    <PluginCard plugin={ID} title="Fragile card">
      <p className="muted">
        Healthy. Press the button in the card before this one.
      </p>
    </PluginCard>
  )
}

type BoundaryProps = { onReset: () => void; children: ReactNode }

class Boundary extends Component<BoundaryProps, { error: unknown }> {
  state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[faulty] contribution failed", error, info.componentStack)
  }

  /**
   * A fill's element is re-registered from an effect, so the repaired
   * contribution arrives one commit after the plugin's own state changed.
   * Clearing the error here rather than in `retry` is what waits for it —
   * resetting any sooner would re-render the element that just threw.
   */
  componentDidUpdate(previous: BoundaryProps) {
    if (this.state.error && previous.children !== this.props.children) {
      this.setState({ error: null })
    }
  }

  retry = () => this.props.onReset()

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return <Failed error={this.state.error} onRetry={this.retry} />
  }
}

function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { notify } = useCrm()

  return (
    <PluginCard plugin={ID} title="Failed">
      <p className="notice">{String(error)}</p>
      <p className="muted">
        The rest of the dashboard kept rendering.{" "}
        <Button
          onClick={() => {
            onRetry()
            notify("faulty: repaired")
          }}
        >
          retry
        </Button>
      </p>
    </PluginCard>
  )
}
