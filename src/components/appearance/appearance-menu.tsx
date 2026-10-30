"use client";

import { Check, Languages, Monitor, Moon, Palette as PaletteIcon, Sun, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { MODES, readStoredAppearance, type ModePreference } from "@/lib/appearance";
import {
  followSystemMode,
  getAppearanceSnapshot,
  getServerAppearanceSnapshot,
  parseSnapshot,
  setAppearance,
  subscribeAppearance,
} from "@/lib/appearance-store";
import { cn } from "@/lib/cn";

// Language names are shown in their own language on purpose.
const LANGUAGE_NAMES: Record<string, string> = { en: "English", fa: "فارسی" };

const MODE_ICONS: Record<ModePreference, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const optionClasses = (selected: boolean) =>
  cn(
    "flex min-h-11 w-full items-center gap-2 rounded-control border px-3 text-sm font-medium transition-all duration-200",
    selected
      ? "border-accent bg-accent/15 text-fg shadow-sm font-semibold"
      : "border-line-strong/60 text-fg hover:border-line-strong hover:bg-raised/70",
  );

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="space-y-2">
      <p className="text-xs font-semibold text-muted">{title}</p>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

export function AppearanceMenu() {
  const t = useTranslations("appearance");
  const locale = useLocale();
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const snapshot = useSyncExternalStore(
    subscribeAppearance,
    getAppearanceSnapshot,
    getServerAppearanceSnapshot,
  );
  const appearance = parseSnapshot(snapshot);
  const { mode } = appearance;

  // Keep "system" mode in sync with the OS preference while the app is open.
  useEffect(() => followSystemMode({ mode }), [mode]);

  // Re-apply persisted appearance after client-side navigation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readStoredAppearance(window.localStorage);
    const current = parseSnapshot(getAppearanceSnapshot());
    if (stored.mode !== current.mode) {
      setAppearance(stored);
    }
  }, [pathname]);

  // Close on Escape (returning focus to the trigger) and on outside press.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        ref={triggerRef}
        label={t("trigger")}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <PaletteIcon aria-hidden="true" className="size-5" />
      </IconButton>

      <div
        id={panelId}
        hidden={!open}
        className="liquid-glass absolute end-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw_-_2rem)] space-y-4 rounded-card p-4 shadow-2xl"
      >
        <Group title={t("language")}>
          {routing.locales.map((code) => (
            <Link
              key={code}
              href={pathname}
              locale={code}
              lang={code}
              hrefLang={code}
              aria-current={code === locale ? "true" : undefined}
              onClick={() => setOpen(false)}
              className={optionClasses(code === locale)}
            >
              <Languages aria-hidden="true" className="size-4 shrink-0" />
              <span className="flex-1 text-start">{LANGUAGE_NAMES[code] ?? code}</span>
              {code === locale ? <Check aria-hidden="true" className="size-4 shrink-0 text-accent" /> : null}
            </Link>
          ))}
        </Group>

        <Group title={t("mode")}>
          {MODES.map((value: ModePreference) => {
            const Icon = MODE_ICONS[value];
            return (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setAppearance({ mode: value })}
                className={optionClasses(mode === value)}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="flex-1 text-start">{t(`modes.${value}`)}</span>
                {mode === value ? <Check aria-hidden="true" className="size-4 shrink-0 text-accent" /> : null}
              </button>
            );
          })}
        </Group>
      </div>
    </div>
  );
}
