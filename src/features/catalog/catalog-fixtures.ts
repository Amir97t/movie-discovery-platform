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
  {
    id: "shadow-frequency",
    title: { en: "Shadow Frequency", fa: "فرکانس سایه" },
    year: 2024,
    rating: 8.0,
    runtimeMinutes: 115,
    genres: ["scifi", "thriller"],
    synopsis: {
      en: "A radio astronomer detects a repeating signal originating from inside the Earth's core.",
      fa: "یک ستاره‌شناس رادیویی سیگنالی تکرارشونده را شناسایی می‌کند که از هسته زمین سرچشمه می‌گیرد.",
    },
    art: ["#0f172a", "#38bdf8"],
  },
  {
    id: "velvet-horizon",
    title: { en: "Velvet Horizon", fa: "افق مخملین" },
    year: 2023,
    rating: 7.5,
    runtimeMinutes: 130,
    genres: ["drama", "romance"],
    art: ["#4a044e", "#f472b6"],
  },
  {
    id: "clockwork-bazaar",
    title: { en: "The Clockwork Bazaar", fa: "بازار کوکی" },
    year: 2022,
    rating: 8.3,
    runtimeMinutes: 108,
    genres: ["fantasy", "adventure"],
    art: ["#422006", "#f59e0b"],
  },
  {
    id: "crimson-tide-echo",
    title: { en: "Echoes of the Crimson Tide", fa: "پژواک‌های جزر و مد سرخ" },
    year: 2024,
    rating: 7.9,
    runtimeMinutes: 122,
    genres: ["action", "thriller"],
    art: ["#450a0a", "#ef4444"],
  },
  {
    id: "silent-cartographer",
    title: { en: "The Silent Cartographer", fa: "نقشه‌نگار خاموش" },
    year: 2021,
    rating: 8.2,
    runtimeMinutes: 99,
    genres: ["documentary", "history"],
    art: ["#14532d", "#4ade80"],
  },
  {
    id: "copper-skies",
    title: { en: "Copper Skies", fa: "آسمان‌های مسی" },
    year: 2025,
    rating: 7.4,
    runtimeMinutes: 110,
    genres: ["scifi"],
    art: ["#7c2d12", "#fb923c"],
  },
  {
    id: "monochrome-waltz",
    title: { en: "Monochrome Waltz", fa: "والس تک‌رنگ" },
    year: 2020,
    rating: 8.5,
    runtimeMinutes: 135,
    genres: ["drama", "filmNoir"],
    art: ["#18181b", "#a1a1aa"],
  },
  {
    id: "starlight-consortium",
    title: { en: "The Starlight Consortium", fa: "کنسرسیوم نور ستارگان" },
    year: 2023,
    rating: 7.1,
    runtimeMinutes: 105,
    genres: ["scifi", "comedy"],
    art: ["#1e1b4b", "#818cf8"],
  },
  {
    id: "desert-mirage",
    title: { en: "Desert Mirage", fa: "سراب کویر" },
    year: 2022,
    rating: 7.8,
    runtimeMinutes: 117,
    genres: ["thriller", "drama"],
    art: ["#78350f", "#fcd34d"],
  },
  {
    id: "iron-haven",
    title: { en: "Iron Haven", fa: "پناهگاه آهنین" },
    year: 2024,
    rating: 8.0,
    runtimeMinutes: 128,
    genres: ["action", "crime"],
    art: ["#1f2937", "#9ca3af"],
  },
  {
    id: "aurora-drift",
    title: { en: "Aurora Drift", fa: "شفق شناور" },
    year: 2025,
    rating: 8.6,
    runtimeMinutes: 114,
    genres: ["animation", "adventure"],
    art: ["#064e3b", "#34d399"],
  },
  {
    id: "whispering-pines",
    title: { en: "Whispering Pines", fa: "کاج‌های زمزمه‌گر" },
    year: 2021,
    rating: 7.3,
    runtimeMinutes: 95,
    genres: ["horror", "thriller"],
    art: ["#022c22", "#10b981"],
  },
  {
    id: "golden-gate-legacy",
    title: { en: "The Golden Gate Legacy", fa: "میراث پل طلایی" },
    year: 2023,
    rating: 7.6,
    runtimeMinutes: 120,
    genres: ["crime", "drama"],
    art: ["#3f2c1d", "#d97706"],
  },
];
