import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps
  extends Omit<ComponentPropsWithRef<"button">, "aria-label" | "children"> {
  /** Required accessible name: icon-only controls must have one. */
  label: string;
  children: ReactNode;
}

export function IconButton({ label, className, type = "button", children, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-pill text-fg transition-colors duration-200 hover:bg-raised",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
