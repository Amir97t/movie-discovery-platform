"use client";

import { Check, Languages, Monitor, Moon, Palette as PaletteIcon, Sun, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { MODES, PALETTES, readStoredAppearance, type ModePreference, type Palette } from "@/lib/appearance";
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
    "flex min-h-11 w-full items-center gap-2 rounded-control border px-3 text-sm font-medium transition-colors duration-200",
    selected ? "border-accent bg-raised text-fg" : "border-line-strong text-fg hover:bg-raised",
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
  const { palette, mode } = appearance;

  // Keep "system" mode in sync with the OS preference while the app is open.
  useEffect(() => followSystemMode({ palette, mode }), [palette, mode]);

  // Re-apply persisted appearance after client-side navigation. The
  // server-rendered <html> resets data-palette to gold on each locale
  // switch, so sync DOM with localStorage whenever the pathname changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readStoredAppearance(window.localStorage);
    const current = parseSnapshot(getAppearanceSnapshot());
    if (stored.palette !== current.palette || stored.mode !== current.mode) {
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
        className="absolute end-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw_-_2rem)] space-y-4 rounded-card border border-line bg-surface p-4 shadow-lg"
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
              {code === locale ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
            </Link>
          ))}
        </Group>

        <Group title={t("palette")}>
          {PALETTES.map((value: Palette) => (
            <button
              key={value}
              type="button"
              aria-pressed={palette === value}
              onClick={() => setAppearance({ palette: value, mode })}
              className={optionClasses(palette === value)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0 rounded-pill",
                  value === "gold" ? "bg-swatch-gold" : "bg-swatch-crimson",
                )}
              />
              <span className="flex-1 text-start">{t(`palettes.${value}`)}</span>
              {palette === value ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
            </button>
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
                onClick={() => setAppearance({ palette, mode: value })}
                className={optionClasses(mode === value)}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="flex-1 text-start">{t(`modes.${value}`)}</span>
                {mode === value ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
              </button>
            );
          })}
        </Group>
      </div>
    </div>
  );
}
