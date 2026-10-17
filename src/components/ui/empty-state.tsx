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
        <div aria-hidden="true" className="text-muted">
          {icon}
        </div>
      ) : null}
      <h2 className="text-xl font-semibold text-fg">{title}</h2>
      {description ? <p className="text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
