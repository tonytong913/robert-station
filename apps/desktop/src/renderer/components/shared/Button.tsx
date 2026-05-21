import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "ghost"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: ButtonVariant
}

export function Button({ children, className = "", type = "button", variant = "primary", ...props }: ButtonProps): ReactElement {
  return (
    <button className={["button", `button--${variant}`, className].filter(Boolean).join(" ")} type={type} {...props}>
      {children}
    </button>
  )
}
