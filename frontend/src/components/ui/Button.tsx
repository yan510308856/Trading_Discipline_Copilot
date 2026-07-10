import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "primary-button",
  secondary: "secondary-button",
  danger: "danger-button",
  ghost: "ghost-button",
};

export function Button({
  children,
  className = "",
  variant = "secondary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${variantClass[variant]} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
