import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover shadow-[0_2px_12px_rgba(229,9,20,0.25)] hover:shadow-[0_4px_20px_rgba(229,9,20,0.4)]",
  secondary:
    "border border-line-strong/60 bg-surface/60 text-fg hover:border-line-strong hover:bg-raised/80",
  ghost: "text-fg hover:bg-raised/80",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
};

interface StyleOptions {
  variant?: Variant;
  size?: Size;
  className?: string;
}

/** Use on <a>/<Link> so link-buttons share the exact same styling. */
export function buttonStyles({ variant = "primary", size = "md", className }: StyleOptions = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleOptions {}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}
