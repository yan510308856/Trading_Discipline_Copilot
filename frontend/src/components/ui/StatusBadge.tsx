import type { ReactNode } from "react";

type StatusBadgeVariant =
  | "allowed"
  | "warning"
  | "blocked"
  | "reminder"
  | "cleared"
  | "not_cleared"
  | "partially_ready"
  | "connected"
  | "checking"
  | "unavailable";

interface StatusBadgeProps {
  children: ReactNode;
  variant: StatusBadgeVariant;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({
  children,
  variant,
  className = "",
  showDot = false,
}: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${variant} ${className}`.trim()}>
      {showDot && <span aria-hidden="true" />}
      {children}
    </span>
  );
}
