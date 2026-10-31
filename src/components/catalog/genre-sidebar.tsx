"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export interface GenreItem {
  key: string;
  label: string;
  href: string;
}

export interface GenreSidebarProps {
  ariaLabelledBy?: string;
  genresTitle: string;
  allLabel: string;
  allHref: string;
  filterButtonLabel: string;
  closeFiltersLabel: string;
  selectedGenreKey?: string;
  genreItems: GenreItem[];
}

export function GenreSidebar({
  ariaLabelledBy = "discover-genres-title",
  genresTitle,
  allLabel,
  allHref,
  filterButtonLabel,
  closeFiltersLabel,
  selectedGenreKey,
  genreItems,
}: GenreSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Focus management on open
  useEffect(() => {
    if (isOpen) {
      drawerRef.current?.focus();
    }
  }, [isOpen]);

  const selectedItem = genreItems.find((item) => item.key === selectedGenreKey);

  return (
    <>
      {/* Mobile Trigger Button (< lg) */}
      <div className="lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-controls="mobile-genre-drawer"
          className="inline-flex items-center gap-2 rounded-xl border border-line-strong/40 bg-surface/70 px-4 py-2 text-sm font-medium text-fg shadow-sm hover:border-accent/40 hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" />
          <span>{filterButtonLabel}</span>
          {selectedItem && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-text">
              {selectedItem.label}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Slide-over Drawer (< lg) */}
      {isOpen && (
        <div className="lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => {
              setIsOpen(false);
              triggerRef.current?.focus();
            }}
            aria-hidden="true"
          />

          {/* Drawer Dialog */}
          <div
            id="mobile-genre-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-genre-title"
            ref={drawerRef}
            tabIndex={-1}
            className="fixed inset-y-0 start-0 z-50 flex w-full max-w-xs flex-col bg-surface shadow-2xl border-e border-line p-6 outline-none animate-in slide-in-from-start duration-200"
          >
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <h2 id="mobile-genre-title" className="text-base font-bold text-fg">
                {genresTitle}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label={closeFiltersLabel}
                className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-1 scrollbar-thin">
              <Link
                href={allHref}
                onClick={() => setIsOpen(false)}
                aria-current={!selectedGenreKey ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  !selectedGenreKey
                    ? "bg-accent text-accent-fg font-semibold shadow-[0_2px_12px_rgba(229,9,20,0.3)]"
                    : "text-muted hover:bg-surface/80 hover:text-fg",
                )}
              >
                <span>{allLabel}</span>
              </Link>

              {genreItems.map((item) => {
                const isSelected = selectedGenreKey === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    aria-current={isSelected ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                      isSelected
                        ? "bg-accent text-accent-fg font-semibold shadow-[0_2px_12px_rgba(229,9,20,0.3)]"
                        : "text-muted hover:bg-surface/80 hover:text-fg",
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Vertical Sidebar (>= lg) */}
      <section
        aria-labelledby={ariaLabelledBy}
        className="hidden lg:block w-52 shrink-0 space-y-3 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin pe-1"
      >
        <h2 id={ariaLabelledBy} className="px-3 text-xs font-bold uppercase tracking-wider text-muted">
          {genresTitle}
        </h2>
        <ul className="space-y-1">
          <li key="all">
            <Link
              href={allHref}
              aria-current={!selectedGenreKey ? "page" : undefined}
              className={cn(
                "group flex items-center justify-between rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-150",
                !selectedGenreKey
                  ? "bg-accent text-accent-fg font-semibold shadow-[0_2px_12px_rgba(229,9,20,0.3)]"
                  : "text-muted hover:bg-surface/70 hover:text-fg",
              )}
            >
              <span>{allLabel}</span>
            </Link>
          </li>
          {genreItems.map((item) => {
            const isSelected = selectedGenreKey === item.key;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={isSelected ? "page" : undefined}
                  className={cn(
                    "group flex items-center justify-between rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-150",
                    isSelected
                      ? "bg-accent text-accent-fg font-semibold shadow-[0_2px_12px_rgba(229,9,20,0.3)]"
                      : "text-muted hover:bg-surface/70 hover:text-fg",
                  )}
                >
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
