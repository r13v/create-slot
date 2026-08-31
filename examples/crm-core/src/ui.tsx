import { useContribution } from "create-slot"
import type { MouseEvent, ReactNode } from "react"

import type { Stage } from "./data"
import { useCrmApi } from "./runtime"

/** A section the shell owns. */
export function Card({
  title,
  hint,
  wide,
  children,
}: {
  title: string
  hint?: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <section className={wide ? "card card--wide" : "card"}>
      <h2 className="card__title">
        {title}
        {hint && <span className="card__hint">{hint}</span>}
      </h2>
      {children}
    </section>
  )
}

/**
 * A section a plugin owns. Identical to `Card` except for the badge, which is
 * there so you can see at a glance who contributed what.
 */
export function PluginCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const owner = useContribution().pluginId

  return (
    <section className="card card--plugin" data-plugin={owner}>
      <h2 className="card__title">
        {title}
        <span className="tag">{owner}</span>
      </h2>
      {children}
    </section>
  )
}

/** A row a plugin contributed to a list. */
export function PluginRow({ children }: { children: ReactNode }) {
  const owner = useContribution().pluginId

  return (
    <li className="row row--plugin" data-plugin={owner}>
      <span className="tag">{owner}</span>
      <span className="row__body">{children}</span>
    </li>
  )
}

export function Button({
  onClick,
  children,
  tone,
  disabled,
}: {
  onClick: () => void
  children: ReactNode
  tone?: "primary" | "danger"
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="btn"
      data-tone={tone}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/**
 * A real `href` that the shell intercepts, so the same markup works in a SPA
 * and in a server-rendered page.
 */
export function Link({
  href,
  current,
  children,
}: {
  href: string
  current?: boolean
  children: ReactNode
}) {
  const api = useCrmApi()

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      return
    }

    event.preventDefault()
    api.navigate(href)
  }

  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
    >
      {children}
    </a>
  )
}

export function StageTag({ stage }: { stage: Stage }) {
  return (
    <span className="stage" data-stage={stage}>
      {stage}
    </span>
  )
}
