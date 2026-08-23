import type { Stage } from "crm-core/data"
import type { MouseEvent, ReactNode } from "react"

import { useCrm } from "./crm"

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
 * A section a plugin owns.
 *
 * The badge is a prop rather than something the library reports: a fill is an
 * element the plugin created itself, so who contributed it is the plugin's own
 * knowledge.
 */
export function PluginCard({
  plugin,
  title,
  children,
}: {
  plugin: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="card card--plugin" data-plugin={plugin}>
      <h2 className="card__title">
        {title}
        <span className="tag">{plugin}</span>
      </h2>
      {children}
    </section>
  )
}

/** A row a plugin contributed to a list. */
export function PluginRow({
  plugin,
  children,
}: {
  plugin: string
  children: ReactNode
}) {
  return (
    <li className="row row--plugin" data-plugin={plugin}>
      <span className="tag">{plugin}</span>
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

/** A real `href`, intercepted by the shell's router. */
export function Link({
  href,
  current,
  children,
}: {
  href: string
  current?: boolean
  children: ReactNode
}) {
  const { navigate } = useCrm()

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      return
    }

    event.preventDefault()
    navigate(href)
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
