import type { HTMLAttributes, ReactElement, ReactNode } from "react"

type PanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  title?: string
}

export function Panel({ children, className = "", title, ...props }: PanelProps): ReactElement {
  return (
    <section className={["panel", className].filter(Boolean).join(" ")} {...props}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  )
}
