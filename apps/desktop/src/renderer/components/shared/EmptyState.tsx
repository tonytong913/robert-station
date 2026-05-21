import type { ReactElement, ReactNode } from "react"

type EmptyStateProps = {
  title: string
  children?: ReactNode
  className?: string
}

export function EmptyState({ title, children, className = "" }: EmptyStateProps): ReactElement {
  return (
    <section className={["empty-state", className].filter(Boolean).join(" ")}>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
    </section>
  )
}
