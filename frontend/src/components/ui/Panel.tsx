import type { ElementType, HTMLAttributes, ReactNode } from "react";

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children: ReactNode;
}

export function Panel({
  as: Component = "section",
  children,
  className = "",
  ...props
}: PanelProps) {
  return (
    <Component className={`panel ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}
