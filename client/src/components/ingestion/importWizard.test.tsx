// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getJob: vi.fn(), getPages: vi.fn(), confirmPages: vi.fn(), getCandidates: vi.fn(), acceptCandidates: vi.fn(),
  deleteJob: vi.fn(), getCapabilities: vi.fn(), uploadDocument: vi.fn(),
  getStructure: vi.fn(), confirmStructure: vi.fn(), getLanguageCandidates: vi.fn(), acceptLesson: vi.fn(),
}));
const push = vi.fn();
vi.mock("@/api/ingestion", () => ({
  ...api,
  ACTIVE_STATUSES: ["queued", "parsing", "pages", "extracting"],
  pageImageUrl: () => "/x.png",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("job=j1"),
  useRouter: () => ({ push, replace: vi.fn() }),
}));

import ImportWizard from "./importWizard";
import LanguageImportWizard from "./languageImportWizard";

const job = (status: string) => ({
  id: "j1", language_id: "l", lesson_id: "les", filename: "book.pdf", handwritten: false, page_from: null, page_to: null,
  status, pages_done: 0, pages_total: 0, error: null, warnings: [], created_at: null,
});

beforeEach(() => { vi.clearAllMocks(); });

describe("lesson ImportWizard", () => {
  it("shows the page-kind screen at status `pages` and posts the (edited) page_kinds map", async () => {
    api.getJob.mockResolvedValue(job("pages"));
    api.getPages.mockResolvedValue({ status: "pages", page_kinds: { "1": ["vocabulary"], "2": ["grammar"] }, first_page: 1, last_page: 2, warnings: [] });
    api.confirmPages.mockResolvedValue({ status: "extracting" });
    render(<ImportWizard languageId="l" lessonId="les" lessonTitle="L1" settingsHref="/s" />);

    expect(await screen.findByText(/Confirm page kinds in book.pdf/)).toBeInTheDocument();
    // add "Passage" to page 1 (first Passage chip)
    await userEvent.click(screen.getAllByRole("button", { name: "Passage" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Continue to extraction" }));

    expect(api.confirmPages).toHaveBeenCalledWith("j1", { "1": ["vocabulary", "passage"], "2": ["grammar"] });
    expect(push).toHaveBeenCalledWith("/languages/l/lesson/les/import");
  });
});

describe("LanguageImportWizard", () => {
  it("shows kind chips in the lesson-range step and confirmStructure receives page_kinds", async () => {
    api.getJob.mockResolvedValue(job("structure"));
    api.getStructure.mockResolvedValue({
      status: "structure", confirmed: false, first_page: 1, last_page: 2, warnings: [], page_kinds: { "1": ["vocabulary"], "2": [] },
      lessons: [{ index: 0, title: "Lesson A", start_page: 1, end_page: 2, verified: true, note: null, status: "pending", error: null, counts: null, created_lesson_id: null }],
    });
    api.confirmStructure.mockResolvedValue({});
    // after confirm the wizard re-polls; keep it quiet
    render(<LanguageImportWizard languageId="l" languageName="Japanese" settingsHref="/s" />);

    expect(await screen.findByDisplayValue("Lesson A")).toBeInTheDocument();
    expect(screen.getByText(/Nothing here or contents page/)).toBeInTheDocument(); // page 2 is []
    await userEvent.click(screen.getAllByRole("button", { name: "Grammar" })[0]); // page 1 += grammar
    await userEvent.click(screen.getByRole("button", { name: /Extract vocabulary from 1 lesson/ }));

    expect(api.confirmStructure).toHaveBeenCalledWith(
      "j1", [{ title: "Lesson A", start_page: 1, end_page: 2 }], { "1": ["vocabulary", "grammar"], "2": [] },
    );
  });
});
