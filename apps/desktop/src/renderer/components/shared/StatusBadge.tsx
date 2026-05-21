import type { ReactElement } from "react"

type StatusBadgeProps = {
  children: string
  tone?: "neutral" | "success" | "warning"
  className?: string
}

export function StatusBadge({ children, className = "", tone = "neutral" }: StatusBadgeProps): ReactElement {
  return <span className={["status-badge", `status-badge--${tone}`, className].filter(Boolean).join(" ")}>{children}</span>
}
