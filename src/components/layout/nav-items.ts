import { Compass, House, type LucideIcon } from "lucide-react";

export interface NavItem {
  key: "home" | "discover";
  href: "/" | "/discover";
  icon: LucideIcon;
  /** Pages not built yet render as disabled placeholders, never as dead links. */
  available: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: "/", icon: House, available: true },
  { key: "discover", href: "/discover", icon: Compass, available: true },
];
