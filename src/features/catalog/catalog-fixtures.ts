import type { GenreKey } from "./catalog-types";

/**
 * Fictional sample titles used for design review and tests. They are not real
 * films; artwork is a generated gradient so no remote image host is needed.
 * The set deliberately includes incomplete and extreme records
 * (no rating, no genres/year/runtime, very long title).
 */
export interface FixtureMovie {
  id: string;
  title: { en: string; fa: string };
  year: number | null;
  rating: number | null;
  runtimeMinutes: number | null;
  genres: GenreKey[];
  synopsis?: { en: string; fa: string };
  art: readonly [string, string];
}

export const FEATURED_FIXTURE_ID = "lantern-archive";

export const FIXTURE_MOVIES: readonly FixtureMovie[] = [
  {
    id: "lantern-archive",
    title: { en: "The Lantern Archive", fa: "بایگانی فانوس" },
    year: 2024,
    rating: 7.8,
    runtimeMinutes: 118,
    genres: ["drama"],
    synopsis: {
      en: "An archivist inherits a city's forgotten film reels and discovers that every one of them has been quietly re-edited.",
      fa: "بایگانی‌داری حلقه‌های فراموش‌شده‌ی فیلم یک شهر را به ارث می‌برد و درمی‌یابد که هرکدام بی‌سروصدا دوباره تدوین شده‌اند.",
    },
    art: ["#3b2a14", "#c98a1b"],
  },
  {
    id: "midnight-aperture",
    title: { en: "Midnight Aperture", fa: "دیافراگم نیمه‌شب" },
    year: 2023,
    rating: 7.2,
    runtimeMinutes: 104,
    genres: ["thriller"],
    art: ["#1b2437", "#4b6bb0"],
  },
  {
    id: "salt-line",
    title: { en: "Salt Line", fa: "خط نمک" },
    year: 2022,
    rating: 8.1,
    runtimeMinutes: 131,
    genres: ["drama"],
    art: ["#2f2a28", "#a89b8c"],
  },
  {
    id: "paper-moons",
    title: {
      en: "Paper Moons Over Harbor City",
      fa: "ماه‌های کاغذی بر فراز شهر بندری",
    },
    year: 2025,
    rating: 7.6,
    runtimeMinutes: 96,
    genres: ["animation"],
    art: ["#14323a", "#3fb0a6"],
  },
  {
    id: "orbit-kitchen",
    title: { en: "Orbit Kitchen", fa: "آشپزخانه‌ی مداری" },
    year: 2021,
    rating: 6.9,
    runtimeMinutes: 101,
    genres: ["comedy", "scifi"],
    art: ["#3a1d2e", "#d1578f"],
  },
  {
    id: "quiet-reel",
    title: { en: "The Quiet Reel", fa: "حلقه‌ی خاموش" },
    year: 2024,
    rating: 8.4,
    runtimeMinutes: 88,
    genres: ["documentary"],
    art: ["#22301f", "#7fa05a"],
  },
  {
    id: "neon-delta",
    title: { en: "Neon Delta", fa: "دلتای نئون" },
    year: 2023,
    rating: 7.0,
    runtimeMinutes: 112,
    genres: ["action", "scifi"],
    art: ["#240f3a", "#8a4be0"],
  },
  {
    id: "hundred-windows",
    title: { en: "A Hundred Windows", fa: "صد پنجره" },
    year: 2020,
    rating: 7.4,
    runtimeMinutes: 109,
    genres: ["romance", "drama"],
    art: ["#3a1a1a", "#d9715f"],
  },
  {
    id: "glass-orchard",
    title: { en: "Glass Orchard", fa: "باغ شیشه‌ای" },
    year: 2022,
    rating: null,
    runtimeMinutes: 98,
    genres: ["thriller"],
    art: ["#17302b", "#58b59b"],
  },
  {
    id: "long-take",
    title: {
      en: "Long Take, Longer Night: The Complete Untold Story of a Single Evening on Platform Nine",
      fa: "نمای بلند، شب بلندتر: روایت کامل و ناگفته‌ی یک عصر در ایستگاه شماره‌ی نه",
    },
    year: 2019,
    rating: 6.5,
    runtimeMinutes: 142,
    genres: ["comedy"],
    art: ["#33290f", "#e0b94a"],
  },
  {
    id: "winter-project",
    title: { en: "Untitled Winter Project", fa: "پروژه‌ی بی‌نام زمستان" },
    year: null,
    rating: null,
    runtimeMinutes: null,
    genres: [],
    art: ["#25282e", "#8d96a8"],
  },
  {
    id: "ember-court",
    title: { en: "Ember Court", fa: "دادگاه شعله" },
    year: 2025,
    rating: 7.7,
    runtimeMinutes: 126,
    genres: ["action"],
    art: ["#3a1608", "#e0671f"],
  },
];
