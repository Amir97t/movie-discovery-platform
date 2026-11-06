"use client";

import { useId, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export interface SearchFormProps {
  initialQuery?: string;
  locale: string;
  inputLabel: string;
  inputPlaceholder: string;
  submitLabel: string;
  className?: string;
}

export function SearchForm({
  initialQuery = "",
  locale,
  inputLabel,
  inputPlaceholder,
  submitLabel,
  className,
}: SearchFormProps) {
  const router = useRouter();
  const inputId = useId();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawQ = formData.get("q");
    const q = typeof rawQ === "string" ? rawQ.trim().replace(/\s+/g, " ") : "";

    if (!q) {
      router.push("/search");
    } else {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <form
      method="GET"
      action={`/${locale}/search`}
      onSubmit={handleSubmit}
      role="search"
      className={cn("relative flex w-full max-w-2xl items-center gap-2", className)}
    >
      <label htmlFor={inputId} className="sr-only">
        {inputLabel}
      </label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          id={inputId}
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder={inputPlaceholder}
          autoComplete="off"
          dir="auto"
          className="w-full rounded-control border border-line bg-surface/80 py-2.5 pe-4 ps-10 text-sm text-fg placeholder:text-muted/70 transition-colors focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <button
        type="submit"
        className="inline-flex min-h-10 items-center justify-center rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition-all hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98]"
      >
        {submitLabel}
      </button>
    </form>
  );
}
