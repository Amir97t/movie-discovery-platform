import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { LocalCommentsSection } from "./local-comments";
import { PersonalProvider } from "@/features/personal/personal-context";
import { resetPersonalStorageCache } from "@/features/personal/personal-storage";
import type { MovieSnapshot } from "@/features/personal/personal-types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: { current?: number; max?: number }) => {
    if (params?.current !== undefined && params?.max !== undefined) {
      return `${params.current} / ${params.max}`;
    }
    return key;
  },
}));

const mockSnapshot: MovieSnapshot = {
  id: "comments-test-movie",
  title: "Comments Movie",
  year: 2025,
  rating: 7.9,
  posterUrl: "/test.jpg",
  art: null,
  genres: ["drama"],
};

describe("LocalCommentsSection", () => {
  beforeEach(() => {
    resetPersonalStorageCache();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<PersonalProvider>{ui}</PersonalProvider>);
  };

  it("renders empty state initially with 0 count", () => {
    renderWithProvider(
      <LocalCommentsSection
        id="comments-test-movie"
        snapshot={mockSnapshot}
        locale="en"
      />
    );

    expect(screen.getByTestId("local-comments-section")).toBeInTheDocument();
    expect(screen.getByTestId("comments-count-badge")).toHaveTextContent("0");
    expect(screen.getByTestId("comments-empty-state")).toBeInTheDocument();
  });

  it("adds a comment, updates count, and clears textarea", () => {
    renderWithProvider(
      <LocalCommentsSection
        id="comments-test-movie"
        snapshot={mockSnapshot}
        locale="en"
      />
    );

    const textarea = screen.getByTestId("comment-input");
    const submitBtn = screen.getByTestId("submit-comment-btn");

    // Initially button disabled because text is empty
    expect(submitBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "A wonderful film with deep themes." } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    expect(textarea).toHaveValue("");
    expect(screen.getByTestId("comments-count-badge")).toHaveTextContent("1");
    expect(screen.getByText("A wonderful film with deep themes.")).toBeInTheDocument();
    expect(screen.queryByTestId("comments-empty-state")).not.toBeInTheDocument();
  }, 30000);

  it("shows validation error when attempting to submit empty/whitespace text", () => {
    renderWithProvider(
      <LocalCommentsSection
        id="comments-test-movie"
        snapshot={mockSnapshot}
        locale="en"
      />
    );

    const form = screen.getByTestId("comment-input").closest("form")!;
    const textarea = screen.getByTestId("comment-input");

    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.submit(form);

    expect(screen.getByTestId("comment-error")).toHaveTextContent("commentEmptyError");
    expect(screen.getByTestId("comments-count-badge")).toHaveTextContent("0");
  });

  it("renders user comments safely as plain text without HTML execution", () => {
    renderWithProvider(
      <LocalCommentsSection
        id="comments-test-movie"
        snapshot={mockSnapshot}
        locale="en"
      />
    );

    const textarea = screen.getByTestId("comment-input");
    const submitBtn = screen.getByTestId("submit-comment-btn");

    const dangerousText = '<img src="x" onerror="alert(1)"> <script>alert("xss")</script>';
    fireEvent.change(textarea, { target: { value: dangerousText } });
    fireEvent.click(submitBtn);

    // Text must be present as pure text content, not an image tag or script element
    const p = screen.getByText(dangerousText);
    expect(p.tagName.toLowerCase()).toBe("p");
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("deletes a comment when delete button is clicked", () => {
    renderWithProvider(
      <LocalCommentsSection
        id="comments-test-movie"
        snapshot={mockSnapshot}
        locale="en"
      />
    );

    const textarea = screen.getByTestId("comment-input");
    const submitBtn = screen.getByTestId("submit-comment-btn");

    fireEvent.change(textarea, { target: { value: "First note to delete" } });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId("comments-count-badge")).toHaveTextContent("1");

    const deleteBtn = screen.getByRole("button", { name: "deleteComment" });
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId("comments-count-badge")).toHaveTextContent("0");
    expect(screen.getByTestId("comments-empty-state")).toBeInTheDocument();
    expect(screen.queryByText("First note to delete")).not.toBeInTheDocument();
  });

  it("displays storage unavailable notice if persistence fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    renderWithProvider(
      <LocalCommentsSection
        id="comments-test-movie"
        snapshot={mockSnapshot}
        locale="en"
      />
    );

    const textarea = screen.getByTestId("comment-input");
    const submitBtn = screen.getByTestId("submit-comment-btn");

    fireEvent.change(textarea, { target: { value: "Test storage error" } });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId("storage-unavailable-notice")).toBeInTheDocument();
  });
});
