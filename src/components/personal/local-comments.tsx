"use client";

import { AlertCircle, MessageSquare, Send, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { usePersonal } from "@/features/personal/personal-context";
import { MAX_COMMENT_LENGTH } from "@/features/personal/personal-storage";
import type { MovieSnapshot } from "@/features/personal/personal-types";
import { cn } from "@/lib/cn";

export interface LocalCommentsProps {
  id: string;
  snapshot: MovieSnapshot;
  locale: string;
  className?: string;
}

/**
 * Local movie notes & comments section.
 * Private browser-local persistence, input validation, plain-text rendering, delete capabilities.
 */
export function LocalCommentsSection({
  id,
  snapshot,
  locale,
  className,
}: LocalCommentsProps) {
  const t = useTranslations("personal");
  const { getComments, addComment, deleteComment, isStorageAvailable, isReady } = usePersonal();

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const comments = isReady ? getComments(id) : [];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = text.trim();
    if (!trimmed) {
      setError(t("commentEmptyError"));
      return;
    }

    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setError(t("commentTooLongError"));
      return;
    }

    setIsSubmitting(true);
    addComment(id, snapshot, trimmed);
    setText("");
    setIsSubmitting(false);
  };

  const handleDelete = (commentId: string) => {
    deleteComment(id, commentId);
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <section
      data-testid="local-comments-section"
      aria-labelledby="local-comments-heading"
      className={cn(
        "rounded-2xl border border-line bg-surface/40 p-6 sm:p-8 space-y-6 shadow-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-4">
        <div>
          <h3
            id="local-comments-heading"
            className="text-lg font-bold tracking-tight text-fg flex items-center gap-2.5"
          >
            <MessageSquare className="size-5 text-accent" />
            <span>{t("commentsHeading")}</span>
            <span
              data-testid="comments-count-badge"
              className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent-text"
            >
              {comments.length}
            </span>
          </h3>
          <p className="mt-1 text-xs text-muted">{t("commentsNotice")}</p>
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            data-testid="comment-input"
            rows={3}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            placeholder={t("commentPlaceholder")}
            maxLength={MAX_COMMENT_LENGTH}
            className="w-full rounded-xl border border-line bg-surface/80 p-3.5 text-sm text-fg placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent resize-y"
          />
          <div className="flex justify-between items-center px-1 text-xs text-muted">
            {error ? (
              <span data-testid="comment-error" className="text-destructive font-medium">
                {error}
              </span>
            ) : (
              <span />
            )}
            <span
              className={cn(
                "tabular-nums",
                text.length > MAX_COMMENT_LENGTH ? "text-destructive font-bold" : "text-muted"
              )}
            >
              {t("charCount", { current: text.length, max: MAX_COMMENT_LENGTH })}
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !text.trim()}
            data-testid="submit-comment-btn"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-xs sm:text-sm font-semibold text-accent-fg shadow-sm transition-all hover:bg-accent/90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Send className="size-3.5 rtl:rotate-180" />
            <span>{isSubmitting ? t("commentSubmitting") : t("commentSubmit")}</span>
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3 pt-2">
        {comments.length === 0 ? (
          <div
            data-testid="comments-empty-state"
            className="rounded-xl border border-dashed border-line p-8 text-center space-y-1.5"
          >
            <p className="text-sm font-semibold text-fg">{t("noCommentsTitle")}</p>
            <p className="text-xs text-muted max-w-md mx-auto">{t("noCommentsDescription")}</p>
          </div>
        ) : (
          <ul data-testid="comments-list" className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                data-testid={`comment-item-${comment.id}`}
                className="group relative rounded-xl border border-line bg-surface/60 p-4 transition-colors hover:border-line-strong/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <span className="text-[11px] font-medium text-muted block">
                      {formatDate(comment.createdAt)}
                    </span>
                    {/* Rendered strictly as safe plain text */}
                    <p className="whitespace-pre-wrap break-words text-sm text-fg leading-relaxed">
                      {comment.text}
                    </p>
                  </div>

                  <button
                    type="button"
                    data-testid={`delete-comment-btn-${comment.id}`}
                    aria-label={t("deleteComment")}
                    onClick={() => handleDelete(comment.id)}
                    className="size-8 flex items-center justify-center rounded-lg text-muted hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive shrink-0"
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">{t("deleteComment")}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isStorageAvailable && (
        <div
          role="status"
          aria-live="polite"
          data-testid="storage-unavailable-notice"
          className="flex items-center gap-1.5 pt-2 text-xs text-amber-500/90 border-t border-line/50"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{t("storageUnavailableNotice")}</span>
        </div>
      )}
    </section>
  );
}
