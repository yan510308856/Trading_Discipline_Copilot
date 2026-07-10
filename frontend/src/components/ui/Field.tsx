import type { LabelHTMLAttributes, ReactNode } from "react";

interface FieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
}

export function Field({ children, className = "", ...props }: FieldProps) {
  return (
    <label className={`field ${className}`.trim()} {...props}>
      {children}
    </label>
  );
}
