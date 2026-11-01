"use client";

import { useEffect, useRef, useState, useCallback, type ComponentType } from "react";
import {
  BookOpen,
  Clapperboard,
  Compass,
  Drama,
  Flame,
  Ghost,
  Heart,
  Landmark,
  Laugh,
  Mountain,
  Music,
  Rocket,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Trophy,
  Users,
  VenetianMask,
  Video,
  Wand2,
  X,
  Zap,
} from "lucide-react";
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

type LucideIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

export const GENRE_ICON_MAP: Record<string, LucideIcon> = {
  action: Flame,
  adventure: Compass,
  animation: Sparkles,
  biography: BookOpen,
  comedy: Laugh,
  crime: ShieldAlert,
  documentary: Video,
  drama: Drama,
  family: Users,
  fantasy: Wand2,
  filmNoir: VenetianMask,
  history: Landmark,
  horror: Ghost,
  music: Music,
  romance: Heart,
  scifi: Rocket,
  sport: Trophy,
  thriller: Zap,
  war: Swords,
  western: Mountain,
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!drawerRef.current) return [];
    const elements = Array.from(
      drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    return elements.filter((el) => el.offsetParent !== null || el === document.activeElement);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    // Restore focus to trigger button
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  // Keyboard focus trap & Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    // 1. Initial focus: focus the first interactive control (close button) upon opening
    const focusables = getFocusableElements();
    if (focusables.length > 0) {
      focusables[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDrawer();
        return;
      }

      if (e.key === "Tab") {
        const currentFocusables = getFocusableElements();
        if (currentFocusables.length === 0) return;

        const first = currentFocusables[0];
        const last = currentFocusables[currentFocusables.length - 1];

        if (e.shiftKey) {
          // Shift+Tab from first item cycles to the last item
          if (document.activeElement === first || !drawerRef.current?.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab from final focusable item cycles to the first item
          if (document.activeElement === last || !drawerRef.current?.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    // Keep focus inside dialog if focus somehow escapes to outside
    const handleFocusIn = (e: FocusEvent) => {
      if (!drawerRef.current) return;
      if (!drawerRef.current.contains(e.target as Node)) {
        const currentFocusables = getFocusableElements();
        if (currentFocusables.length > 0) {
          currentFocusables[0].focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [isOpen, closeDrawer, getFocusableElements]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
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
          className="inline-flex items-center gap-2.5 rounded-xl border border-line-strong/30 bg-surface/80 backdrop-blur-md px-4 py-2.5 text-sm font-medium text-fg shadow-sm hover:border-accent/40 hover:bg-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" />
          <span>{filterButtonLabel}</span>
          {selectedItem && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/30 px-2.5 py-0.5 text-xs font-semibold text-accent-text">
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
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={closeDrawer}
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
            className="fixed inset-y-0 start-0 z-50 flex w-full max-w-xs flex-col bg-surface/95 backdrop-blur-xl shadow-2xl border-e border-line/60 p-5 outline-none animate-in slide-in-from-start duration-200"
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-line/50">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                </div>
                <h2 id="mobile-genre-title" className="text-base font-bold text-fg">
                  {genresTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label={closeFiltersLabel}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-raised hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label={genresTitle} className="flex-1 overflow-y-auto py-3.5 space-y-1 sidebar-scroll pe-1.5">
              {/* All Genres entry */}
              <div className="mb-2 pb-2 border-b border-line/30">
                <Link
                  href={allHref}
                  onClick={closeDrawer}
                  aria-current={!selectedGenreKey ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    !selectedGenreKey
                      ? "bg-accent/15 border border-accent/30 text-fg font-semibold shadow-[0_2px_12px_rgba(229,9,20,0.12)]"
                      : "text-muted hover:bg-surface-raised/70 hover:text-fg border border-transparent",
                  )}
                >
                  {!selectedGenreKey && (
                    <span
                      className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-accent shadow-[0_0_8px_rgba(229,9,20,0.8)]"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                      !selectedGenreKey
                        ? "bg-accent text-accent-fg shadow-[0_0_10px_rgba(229,9,20,0.35)]"
                        : "bg-surface-raised/80 text-muted group-hover:bg-accent/15 group-hover:text-accent",
                    )}
                  >
                    <Clapperboard className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="truncate">{allLabel}</span>
                </Link>
              </div>

              {genreItems.map((item) => {
                const isSelected = selectedGenreKey === item.key;
                const IconComponent = GENRE_ICON_MAP[item.key] ?? Clapperboard;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={closeDrawer}
                    aria-current={isSelected ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      isSelected
                        ? "bg-accent/15 border border-accent/30 text-fg font-semibold shadow-[0_2px_12px_rgba(229,9,20,0.12)]"
                        : "text-muted hover:bg-surface-raised/70 hover:text-fg border border-transparent",
                    )}
                  >
                    {isSelected && (
                      <span
                        className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-accent shadow-[0_0_8px_rgba(229,9,20,0.8)]"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-accent text-accent-fg shadow-[0_0_10px_rgba(229,9,20,0.35)]"
                          : "bg-surface-raised/80 text-muted group-hover:bg-accent/15 group-hover:text-accent",
                      )}
                    >
                      <IconComponent className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop Vertical Sidebar (>= lg) with semantic navigation markup */}
      <section
        aria-labelledby={ariaLabelledBy}
        className="hidden lg:flex lg:flex-col w-60 shrink-0 rounded-2xl border border-line/60 bg-surface/80 backdrop-blur-xl p-3 shadow-lg shadow-black/20 sticky top-24 self-start max-h-[calc(100vh-7.5rem)] transition-colors"
      >
        <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1.5 border-b border-line/40">
          <div className="flex size-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </div>
          <h2 id={ariaLabelledBy} className="text-xs font-bold uppercase tracking-wider text-muted">
            {genresTitle}
          </h2>
        </div>

        <nav aria-label={genresTitle} className="flex-1 overflow-y-auto pe-1.5 sidebar-scroll space-y-1">
          <ul className="space-y-1">
            {/* Distinct "All Genres" entry */}
            <li key="all" className="mb-2 pb-2 border-b border-line/30">
              <Link
                href={allHref}
                aria-current={!selectedGenreKey ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  !selectedGenreKey
                    ? "bg-accent/15 border border-accent/30 text-fg font-semibold shadow-[0_2px_12px_rgba(229,9,20,0.12)]"
                    : "text-muted hover:bg-surface-raised/70 hover:text-fg border border-transparent",
                )}
              >
                {!selectedGenreKey && (
                  <span
                    className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-accent shadow-[0_0_8px_rgba(229,9,20,0.8)]"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                    !selectedGenreKey
                      ? "bg-accent text-accent-fg shadow-[0_0_10px_rgba(229,9,20,0.35)]"
                      : "bg-surface-raised/80 text-muted group-hover:bg-accent/15 group-hover:text-accent",
                  )}
                >
                  <Clapperboard className="size-3.5" aria-hidden="true" />
                </span>
                <span className="truncate">{allLabel}</span>
              </Link>
            </li>

            {genreItems.map((item) => {
              const isSelected = selectedGenreKey === item.key;
              const IconComponent = GENRE_ICON_MAP[item.key] ?? Clapperboard;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={isSelected ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      isSelected
                        ? "bg-accent/15 border border-accent/30 text-fg font-semibold shadow-[0_2px_12px_rgba(229,9,20,0.12)]"
                        : "text-muted hover:bg-surface-raised/70 hover:text-fg border border-transparent",
                    )}
                  >
                    {isSelected && (
                      <span
                        className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-accent shadow-[0_0_8px_rgba(229,9,20,0.8)]"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-accent text-accent-fg shadow-[0_0_10px_rgba(229,9,20,0.35)]"
                          : "bg-surface-raised/80 text-muted group-hover:bg-accent/15 group-hover:text-accent",
                      )}
                    >
                      <IconComponent className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </section>
    </>
  );
}
