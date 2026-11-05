"use client";

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Download,
  Edit3,
  Film,
  Heart,
  MessageSquare,
  Star,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePersonal } from "@/features/personal/personal-context";
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  validateImportPayload,
} from "@/features/personal/personal-storage";
import type {
  ImportPreviewSummary,
  PersonalBackupV1,
} from "@/features/personal/personal-types";

export function ProfileClient() {
  const t = useTranslations("profile");
  const tPersonal = useTranslations("personal");
  const {
    profile,
    updateProfile,
    statistics,
    exportBackup,
    importBackup,
    resetAllData,
    isStorageAvailable,
  } = usePersonal();

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importCandidate, setImportCandidate] = useState<{
    data: PersonalBackupV1;
    summary: ImportPreviewSummary;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Reset State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");

  const handleOpenEdit = () => {
    setDisplayName(profile?.displayName || "");
    setBio(profile?.bio || "");
    setStatusMessage(null);
    setIsEditing(true);
  };

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    updateProfile({ displayName, bio });
    setIsEditing(false);
    setStatusMessage(t("profileSaved"));
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Export JSON Backup
  const handleExport = () => {
    const backup = exportBackup();
    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `movie-discovery-platform-backup-${dateStr}.json`;

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    // Allow the browser engine sufficient time to initiate the download stream before revoking
    setTimeout(() => {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
      URL.revokeObjectURL(url);
    }, 1000);
  };

  // File Selection & Validation
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const result = validateImportPayload(parsed);

        if (result.success) {
          setImportCandidate({ data: result.data, summary: result.summary });
        } else {
          setImportError(result.error);
        }
      } catch {
        setImportError("Failed to parse JSON file. Please ensure it is a valid backup.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!importCandidate) return;
    importBackup(importCandidate.data);
    setImportCandidate(null);
    setStatusMessage(t("dataManagement.importSuccess"));
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleConfirmReset = () => {
    if (resetConfirmInput.trim() !== "RESET") return;
    resetAllData();
    setIsResetOpen(false);
    setResetConfirmInput("");
    setStatusMessage(t("dataManagement.resetSuccess"));
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const initials = useMemo(() => {
    const name = profile?.displayName?.trim() || "";
    if (!name) return "FP";
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [profile?.displayName]);

  return (
    <div className="space-y-10" data-testid="profile-container">
      {/* Status banner */}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          data-testid="profile-status-message"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-500 shadow-sm transition-all"
        >
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Storage unavailable notification */}
      {!isStorageAvailable && (
        <div
          role="status"
          aria-live="polite"
          data-testid="storage-unavailable-notice"
          className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{tPersonal("storageUnavailableNotice")}</span>
        </div>
      )}

      {/* Profile Card */}
      <section
        data-testid="profile-header-card"
        className="relative overflow-hidden rounded-2xl border border-line bg-surface/40 p-6 sm:p-8 shadow-sm backdrop-blur-md"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4 sm:gap-6">
            {/* Avatar Pill */}
            <div
              data-testid="profile-avatar"
              className="flex size-16 sm:size-20 shrink-0 items-center justify-center rounded-2xl border border-line-strong bg-accent/15 text-accent-text text-xl sm:text-2xl font-black tracking-wider shadow-inner"
            >
              {profile?.displayName ? initials : <User className="size-8" />}
            </div>

            {/* Profile info */}
            <div className="space-y-2">
              <h2
                data-testid="profile-display-name"
                className="text-xl sm:text-2xl font-bold tracking-tight text-fg"
              >
                {profile?.displayName || t("defaultName")}
              </h2>
              <p
                data-testid="profile-bio"
                className="max-w-xl text-xs sm:text-sm leading-relaxed text-muted whitespace-pre-wrap"
              >
                {profile?.bio || t("defaultBio")}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="edit-profile-btn"
            onClick={handleOpenEdit}
            className="inline-flex items-center gap-2 self-start rounded-full border border-line bg-surface px-4 py-2 text-xs sm:text-sm font-semibold text-fg hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Edit3 className="size-4" />
            <span>{t("editProfile")}</span>
          </button>
        </div>

        {/* Edit Profile Form Modal / Inline drawer */}
        {isEditing && (
          <form
            onSubmit={handleSaveProfile}
            data-testid="edit-profile-form"
            className="mt-6 border-t border-line pt-6 space-y-4"
          >
            <div className="space-y-1">
              <label htmlFor="displayNameInput" className="text-xs font-semibold text-muted">
                {t("displayName")}
              </label>
              <input
                id="displayNameInput"
                data-testid="display-name-input"
                type="text"
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("displayNamePlaceholder")}
                className="w-full rounded-xl border border-line bg-surface p-3 text-sm text-fg placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <div className="text-right text-[11px] text-muted tabular-nums">
                {displayName.length} / {MAX_DISPLAY_NAME_LENGTH}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="bioInput" className="text-xs font-semibold text-muted">
                {t("bio")}
              </label>
              <textarea
                id="bioInput"
                data-testid="bio-input"
                rows={3}
                maxLength={MAX_BIO_LENGTH}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t("bioPlaceholder")}
                className="w-full rounded-xl border border-line bg-surface p-3 text-sm text-fg placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent resize-y"
              />
              <div className="text-right text-[11px] text-muted tabular-nums">
                {bio.length} / {MAX_BIO_LENGTH}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                data-testid="cancel-edit-btn"
                onClick={() => setIsEditing(false)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-muted hover:text-fg hover:bg-surface transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                data-testid="save-profile-btn"
                className="rounded-full bg-accent px-5 py-2 text-xs sm:text-sm font-semibold text-accent-fg shadow-sm hover:bg-accent/90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t("saveChanges")}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Personal Statistics Grid */}
      <section data-testid="profile-stats-section" className="space-y-4">
        <h3 className="text-lg font-bold tracking-tight text-fg flex items-center gap-2">
          <Film className="size-5 text-accent" />
          <span>{t("stats.heading")}</span>
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Favorites */}
          <Link
            href="/library?tab=favorites"
            data-testid="stat-card-favorites"
            className="group rounded-2xl border border-line bg-surface/50 p-4 transition-all hover:border-line-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="flex items-center justify-between text-muted group-hover:text-favorite">
              <span className="text-xs font-medium">{t("stats.favorites")}</span>
              <Heart className="size-4 group-hover:fill-current" />
            </div>
            <div data-testid="stat-count-favorites" className="mt-3 text-2xl font-black text-fg tabular-nums">
              {statistics.favoritesCount}
            </div>
          </Link>

          {/* Watchlist */}
          <Link
            href="/library?tab=watchlist"
            data-testid="stat-card-watchlist"
            className="group rounded-2xl border border-line bg-surface/50 p-4 transition-all hover:border-line-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="flex items-center justify-between text-muted group-hover:text-accent">
              <span className="text-xs font-medium">{t("stats.watchlist")}</span>
              <Bookmark className="size-4" />
            </div>
            <div data-testid="stat-count-watchlist" className="mt-3 text-2xl font-black text-fg tabular-nums">
              {statistics.watchlistCount}
            </div>
          </Link>

          {/* Watched */}
          <Link
            href="/library?tab=watched"
            data-testid="stat-card-watched"
            className="group rounded-2xl border border-line bg-surface/50 p-4 transition-all hover:border-line-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="flex items-center justify-between text-muted group-hover:text-emerald-500">
              <span className="text-xs font-medium">{t("stats.watched")}</span>
              <CheckCircle2 className="size-4" />
            </div>
            <div data-testid="stat-count-watched" className="mt-3 text-2xl font-black text-fg tabular-nums">
              {statistics.watchedCount}
            </div>
          </Link>

          {/* Rated */}
          <div
            data-testid="stat-card-rated"
            className="rounded-2xl border border-line bg-surface/50 p-4"
          >
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-medium">{t("stats.rated")}</span>
              <Star className="size-4 text-favorite" />
            </div>
            <div data-testid="stat-count-rated" className="mt-3 text-2xl font-black text-fg tabular-nums">
              {statistics.ratedCount}
            </div>
          </div>

          {/* Average Rating */}
          <div
            data-testid="stat-card-avg-rating"
            className="rounded-2xl border border-line bg-surface/50 p-4"
          >
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-medium">{t("stats.avgRating")}</span>
              <span className="text-[10px] font-bold text-favorite">/ 10</span>
            </div>
            <div data-testid="stat-value-avg-rating" className="mt-3 text-2xl font-black text-fg tabular-nums">
              {statistics.averageRating !== null ? statistics.averageRating.toFixed(1) : "—"}
            </div>
          </div>

          {/* Comments */}
          <div
            data-testid="stat-card-comments"
            className="rounded-2xl border border-line bg-surface/50 p-4"
          >
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-medium">{t("stats.comments")}</span>
              <MessageSquare className="size-4 text-accent" />
            </div>
            <div data-testid="stat-count-comments" className="mt-3 text-2xl font-black text-fg tabular-nums">
              {statistics.totalCommentsCount}
            </div>
          </div>
        </div>

        {/* Favorite Genres Breakdown */}
        <div
          data-testid="favorite-genres-box"
          className="rounded-2xl border border-line bg-surface/40 p-5 space-y-3"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-muted">
            {t("stats.genresHeading")}
          </div>

          {statistics.favoriteGenres.length === 0 ? (
            <p data-testid="no-genres-text" className="text-xs text-muted">
              {t("stats.noGenres")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1" data-testid="favorite-genres-list">
              {statistics.favoriteGenres.map((item) => (
                <span
                  key={item.genre}
                  data-testid={`genre-pill-${item.genre}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-strong/60 bg-surface px-3 py-1 text-xs font-semibold text-fg shadow-sm"
                >
                  <span>{item.genre}</span>
                  <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[10px] font-black text-accent-text tabular-nums">
                    {item.count}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Data Management Section */}
      <section
        data-testid="data-management-section"
        className="rounded-2xl border border-line bg-surface/30 p-6 sm:p-8 space-y-6"
      >
        <div>
          <h3 className="text-lg font-bold tracking-tight text-fg">
            {t("dataManagement.heading")}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {t("dataManagement.subheading")}
          </p>
        </div>

        {importError && (
          <div
            role="alert"
            data-testid="import-error-banner"
            className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>{importError}</span>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
          <div className="flex flex-wrap items-center gap-3">
            {/* Export Button */}
            <button
              type="button"
              data-testid="export-backup-btn"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs sm:text-sm font-semibold text-fg hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Download className="size-4" />
              <span>{t("dataManagement.exportBtn")}</span>
            </button>

            {/* Import Button */}
            <input
              ref={fileInputRef}
              type="file"
              data-testid="import-file-input"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              data-testid="import-backup-btn"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs sm:text-sm font-semibold text-fg hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Upload className="size-4" />
              <span>{t("dataManagement.importBtn")}</span>
            </button>
          </div>

          {/* Reset Button */}
          <button
            type="button"
            data-testid="reset-data-btn"
            onClick={() => {
              setResetConfirmInput("");
              setIsResetOpen(true);
            }}
            className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs sm:text-sm font-semibold text-destructive hover:bg-destructive/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          >
            <Trash2 className="size-4" />
            <span>{t("dataManagement.resetBtn")}</span>
          </button>
        </div>
      </section>

      {/* Import Preview Modal */}
      {importCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="import-preview-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-bold text-fg">
                  {t("dataManagement.importModalTitle")}
                </h4>
                <p className="mt-1 text-xs text-muted">
                  {t("dataManagement.importModalDesc")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportCandidate(null)}
                className="rounded-lg p-1.5 text-muted hover:text-fg hover:bg-surface-elevated"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-line bg-surface/50 p-3">
                <span className="text-muted block">{t("stats.heading")}</span>
                <span data-testid="preview-movie-count" className="text-lg font-bold text-fg">
                  {importCandidate.summary.moviesCount} titles
                </span>
              </div>
              <div className="rounded-xl border border-line bg-surface/50 p-3">
                <span className="text-muted block">{t("stats.favorites")}</span>
                <span data-testid="preview-fav-count" className="text-lg font-bold text-fg">
                  {importCandidate.summary.favoritesCount}
                </span>
              </div>
              <div className="rounded-xl border border-line bg-surface/50 p-3">
                <span className="text-muted block">{t("stats.watchlist")}</span>
                <span data-testid="preview-watchlist-count" className="text-lg font-bold text-fg">
                  {importCandidate.summary.watchlistCount}
                </span>
              </div>
              <div className="rounded-xl border border-line bg-surface/50 p-3">
                <span className="text-muted block">{t("stats.watched")}</span>
                <span data-testid="preview-watched-count" className="text-lg font-bold text-fg">
                  {importCandidate.summary.watchedCount}
                </span>
              </div>
              <div className="rounded-xl border border-line bg-surface/50 p-3">
                <span className="text-muted block">{t("stats.rated")}</span>
                <span data-testid="preview-rated-count" className="text-lg font-bold text-fg">
                  {importCandidate.summary.ratedCount}
                </span>
              </div>
              <div className="rounded-xl border border-line bg-surface/50 p-3">
                <span className="text-muted block">{t("stats.comments")}</span>
                <span data-testid="preview-comments-count" className="text-lg font-bold text-fg">
                  {importCandidate.summary.commentsCount}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
              <button
                type="button"
                data-testid="cancel-import-btn"
                onClick={() => setImportCandidate(null)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-muted hover:text-fg hover:bg-surface-elevated transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                data-testid="confirm-import-btn"
                onClick={handleConfirmImport}
                className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-accent-fg shadow-sm hover:bg-accent/90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t("dataManagement.importConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {isResetOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          data-testid="reset-confirmation-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="size-6 shrink-0" />
              <h4 className="text-base font-bold">
                {t("dataManagement.resetWarningTitle")}
              </h4>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              {t("dataManagement.resetWarningDesc")}
            </p>

            <div className="space-y-1.5 pt-2">
              <label htmlFor="resetPhraseInput" className="text-xs font-semibold text-fg">
                {t("dataManagement.resetTypePrompt", { phrase: "RESET" })}
              </label>
              <input
                id="resetPhraseInput"
                data-testid="reset-confirm-input"
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="RESET"
                className="w-full rounded-xl border border-destructive/40 bg-surface-elevated p-2.5 text-center font-mono text-sm uppercase tracking-widest text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
              <button
                type="button"
                data-testid="cancel-reset-btn"
                onClick={() => setIsResetOpen(false)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-muted hover:text-fg hover:bg-surface-elevated transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                data-testid="confirm-reset-btn"
                disabled={resetConfirmInput.trim() !== "RESET"}
                onClick={handleConfirmReset}
                className="rounded-full bg-destructive px-5 py-2 text-xs font-semibold text-destructive-fg shadow-sm transition-all hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              >
                {t("dataManagement.resetConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
