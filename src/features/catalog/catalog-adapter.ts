import type { Movie } from "./catalog-types";

/**
 * Normalizes the documented CodingFront API shapes at the boundary.
 * Endpoint documentation was supplied by the project owner; live responses
 * are still unverified. This module is intentionally isolated from page code.
 */
export const MOVIES_API_ORIGIN = "https://moviesapi.codingfront.dev";
const MOVIES_API_HOST = new URL(MOVIES_API_ORIGIN).hostname;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return null;
}

function parseYear(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : asString(value);
  const match = text ? /\b(19|20)\d{2}\b/.exec(text) : null;
  return match ? Number(match[0]) : null;
}

function parseRating(value: unknown): number | null {
  const text = typeof value === "number" ? null : asString(value);
  const n = typeof value === "number" ? value : text === null ? NaN : Number(text);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
}

function parseRuntime(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const match = /(\d+)/.exec(asString(value) ?? "");
  return match ? Number(match[1]) : null;
}

/**
 * Converts documented absolute URLs, root-relative paths and poster basenames
 * into URLs accepted by the app's explicit Next Image remote-host allowlist.
 * Unknown external hosts are rejected so malformed/unexpected API data falls
 * back to local artwork instead of causing a next/image runtime error.
 */
export function normalizeImageUrl(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;

  const allow = (url: URL): string | null =>
    url.protocol === "https:" &&
    url.hostname === MOVIES_API_HOST &&
    url.pathname.startsWith("/images/") &&
    url.pathname.length > "/images/".length
      ? url.toString()
      : null;

  try {
    return allow(new URL(raw));
  } catch {
    // It may be a relative URL or a file name.
  }

  if (raw.startsWith("//")) {
    try {
      return allow(new URL(`https:${raw}`));
    } catch {
      return null;
    }
  }

  try {
    if (raw.startsWith("/")) return allow(new URL(raw, MOVIES_API_ORIGIN));

    const decodedParts = raw.split("/").map((part) => decodeURIComponent(part));
    if (decodedParts.some((part) => part === "." || part === "..")) return null;
    const safePath = decodedParts.map((part) => encodeURIComponent(part)).join("/");
    const imagePath = safePath.startsWith("images/") ? `/${safePath}` : `/images/${safePath}`;
    return allow(new URL(imagePath, MOVIES_API_ORIGIN));
  } catch {
    return null;
  }
}

function normalizeImageList(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return entries.map(normalizeImageUrl).filter((url): url is string => url !== null);
}

export function normalizeMovie(input: unknown): Movie | null {
  const record = asRecord(input);
  if (!record) return null;

  const rawId = record.id;
  const id = typeof rawId === "number" && Number.isFinite(rawId) ? String(rawId) : asString(rawId);
  const title = asString(record.title);
  if (!id || !title) return null;

  const images = normalizeImageList(record.images);

  return {
    id,
    title,
    year: parseYear(record.released ?? record.year),
    rating: parseRating(record.imdb_rating ?? record.rating),
    runtimeMinutes: parseRuntime(record.runtime),
    genres: Array.isArray(record.genres)
      ? record.genres.map(asString).filter((genre): genre is string => genre !== null)
      : [],
    synopsis: asString(record.plot),
    posterUrl: normalizeImageUrl(record.poster),
    backdropUrl: images[0] ?? null,
    art: null,
  };
}

/** Accepts a bare array or a documented `{ data: [...] }` response. */
export function normalizeMovieList(input: unknown): Movie[] {
  const list = Array.isArray(input) ? input : asRecord(input)?.data;
  if (!Array.isArray(list)) return [];
  return list.map(normalizeMovie).filter((movie): movie is Movie => movie !== null);
}
