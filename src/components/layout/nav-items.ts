import { Compass, House, LibraryBig, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  key: "home" | "discover" | "library" | "profile";
  href: "/" | "/discover" | "/library" | "/profile";
  icon: LucideIcon;
  /** Pages not built yet render as disabled placeholders, never as dead links. */
  available: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: "/", icon: House, available: true },
  { key: "discover", href: "/discover", icon: Compass, available: true },
  { key: "library", href: "/library", icon: LibraryBig, available: true },
  { key: "profile", href: "/profile", icon: UserRound, available: true },
];
