export interface MovieSnapshot {
  id: string;
  title: string;
  year: number | null;
  rating: number | null;
  posterUrl: string | null;
  art: readonly [string, string] | null;
  genres: string[];
}

export type ListStatus = "watchlist" | "watched" | null;

export interface PersonalComment {
  id: string;
  text: string;
  createdAt: string;
}

export interface PersonalRecord {
  id: string;
  snapshot: MovieSnapshot;
  isFavorite: boolean;
  listStatus: ListStatus;
  personalRating?: number | null;
  comments?: PersonalComment[];
  updatedAt: string;
}

export interface PersonalProfile {
  displayName: string;
  bio: string;
}

export interface PersonalStorageSchemaV1 {
  version: 1;
  movies: Record<string, PersonalRecord>;
  profile?: PersonalProfile;
}

export type PersonalStorageSchema = PersonalStorageSchemaV1;

export type LibraryTab = "favorites" | "watchlist" | "watched";

export type LibrarySortOption = "recently-updated" | "title-asc" | "year-desc" | "rating-desc";

export interface GenreCount {
  genre: string;
  count: number;
}

export interface PersonalStatistics {
  favoritesCount: number;
  watchlistCount: number;
  watchedCount: number;
  ratedCount: number;
  averageRating: number | null;
  totalCommentsCount: number;
  favoriteGenres: GenreCount[];
}

export interface PersonalBackupV1 {
  format: "movie-discovery-platform-backup";
  version: 1;
  exportedAt: string;
  profile?: PersonalProfile;
  movies: Record<string, PersonalRecord>;
}

export interface ImportPreviewSummary {
  moviesCount: number;
  favoritesCount: number;
  watchlistCount: number;
  watchedCount: number;
  ratedCount: number;
  commentsCount: number;
  hasProfile: boolean;
  profileDisplayName?: string;
}

export type ImportValidationResult =
  | { success: true; data: PersonalBackupV1; summary: ImportPreviewSummary }
  | { success: false; error: string };
