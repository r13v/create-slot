import { Component, type ErrorInfo, type ReactNode } from "react"

type RenderCaught = (state: { error: unknown; reset: () => void }) => ReactNode

type Props = {
  children: ReactNode
  renderFailed?: RenderCaught
  onError?: (error: unknown, info: ErrorInfo) => void
}

type State = { error: unknown | null }

/**
 * Failure isolation is the host's job, not the contribution author's.
 *
 * There is no reset-on-update here on purpose. The boundary sits directly
 * around the contribution, in the same commit, so React's own behaviour is
 * enough; an automatic reset would loop as soon as the host re-renders in
 * response to `onError`.
 */
export class PluginErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error ?? new Error("Plugin threw a non-error value") }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state

    if (error === null) {
      return this.props.children
    }

    return this.props.renderFailed?.({ error, reset: this.reset }) ?? null
  }
}
