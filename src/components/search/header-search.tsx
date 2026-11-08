"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { SearchForm } from "./search-form";

export function HeaderSearch() {
  const tA11y = useTranslations("a11y");
  const tSearch = useTranslations("search");
  const locale = useLocale();
  const pathname = usePathname();
  const panelId = useId();

  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input immediately upon opening.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      const rafId = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [open]);

  // Handle keyboard (Escape) and click-outside dismissal.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="static sm:relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={tA11y("searchMovies")}
        title={tA11y("searchMovies")}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid="global-search-button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-pill text-fg transition-colors duration-200 hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
          open && "bg-raised text-accent-text",
        )}
      >
        <Search className="size-5" />
        <span className="sr-only">{tA11y("searchMovies")}</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        data-testid="global-search-panel"
        className={cn(
          "liquid-glass absolute start-2 end-2 top-full z-50 mt-2 rounded-card p-3 shadow-2xl sm:start-auto sm:end-0 sm:w-[28rem] sm:max-w-[calc(100vw-2rem)]",
          !open && "hidden",
        )}
      >
        {open && (
          <SearchForm
            locale={locale}
            inputLabel={tSearch("inputLabel")}
            inputPlaceholder={tSearch("inputPlaceholder")}
            submitLabel={tSearch("submit")}
            onSearchSubmit={() => setOpen(false)}
            inputRef={inputRef}
            autoFocus
          />
        )}
      </div>
    </div>
  );
}
