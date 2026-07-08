import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "icon";
  icon?: string;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-white hover:opacity-90",
  outline: "border border-border bg-card hover:bg-secondary transition-colors",
  icon: "h-9 w-9 justify-center px-0 rounded-lg border border-border bg-card hover:bg-secondary",
};

export default function Button({ variant = "primary", icon, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {icon && <svg className="icon icon-sm"><use href={`#${icon}`} /></svg>}
      {children}
    </button>
  );
}
