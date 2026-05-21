import type { ReactElement, ReactNode } from "react"

type FieldGroupProps = {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}

export function FieldGroup({ label, children, hint, className = "" }: FieldGroupProps): ReactElement {
  return (
    <label className={["field-group", className].filter(Boolean).join(" ")}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}
