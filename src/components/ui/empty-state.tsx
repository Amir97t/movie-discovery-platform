import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-surface/60 text-accent shadow-sm"
        >
          {icon}
        </div>
      ) : null}
      <h2 className="mt-2 text-xl font-bold tracking-tight text-fg">{title}</h2>
      {description ? <p className="text-sm leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
