// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReviewPanel from "./reviewPanel";
import type { Candidate } from "@/lib/ingestion/review";

vi.mock("@/api/ingestion", () => ({ pageImageUrl: () => "/x.png" }));

const grammar: Candidate = {
  id: "g1", kind: "grammar", title: "Te-form", explanation: "Connects verbs", example_sentences: ["Tabete iru."], original_text: "This is the original OCR text from the page.",
  quote: "te-form", page: 2, chunk_id: "c", status: "flagged", flags: [], min_conf: null,
};

const grammarGenerated: Candidate = {
  id: "g2", kind: "grammar", title: "Present form", explanation: "Regular verbs", example_sentences: ["Taberu."], original_text: "Present form text",
  quote: "present", page: 1, chunk_id: "c", status: "flagged",
  flags: [{ code: "grammar_generated", message: "Written by the model from the page text - check it", severity: "warning" }],
  min_conf: null,
};

const exercise: Candidate = {
  id: "e1", kind: "exercise", exercise_type: "answering", question: "What is this?", answer: "It is this",
  quote: "What is this?", page: 1, chunk_id: "c", status: "verified", flags: [], min_conf: null,
};

const exerciseGenerated: Candidate = {
  id: "e2", kind: "exercise", exercise_type: "essay", question: "Write about it", answer: "Generated answer",
  quote: "Write about it", page: 0, chunk_id: "c", status: "flagged",
  flags: [{ code: "answer_generated", message: "Sample answer written by the model - check it", severity: "warning" }],
  min_conf: null,
};

describe("ReviewPanel", () => {
  it("renders a grammar candidate and sends it in `elements` once selected", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[grammar]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);

    expect(screen.getByDisplayValue("Te-form")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Connects verbs")).toBeInTheDocument();
    // flagged => opt-in: nothing selected, add disabled
    const add = screen.getByRole("button", { name: "Add 0" });
    expect(add).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: "Include Te-form" }));
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));

    expect(onAdd).toHaveBeenCalledWith({
      items: [],
      elements: [{ kind: "grammar", fields: { title: "Te-form", explanation: "Connects verbs", example_sentences: ["Tabete iru."] } }],
    });
  });

  it("sends edits the user made to the grammar fields", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="b" candidates={[{ ...grammar, status: "verified" }]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    const title = screen.getByDisplayValue("Te-form");
    await userEvent.clear(title);
    await userEvent.type(title, "Te form 2");
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    expect(onAdd.mock.calls[0][0].elements[0].fields.title).toBe("Te form 2");
  });

  it("renders an exercise candidate and sends it in `elements` once selected", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[exercise]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);

    expect(screen.getByDisplayValue("What is this?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("It is this")).toBeInTheDocument();
    // verified => pre-selected, add enabled
    const add = screen.getByRole("button", { name: "Add 1" });
    expect(add).not.toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));

    expect(onAdd).toHaveBeenCalledWith({
      items: [],
      elements: [{ kind: "exercise", fields: { exercise_type: "answering", question: "What is this?", answer: "It is this", text_support: null, content: null } }],
    });
  });

  it("renders exercise with answer_generated flag", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[exerciseGenerated]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);

    expect(screen.getByDisplayValue("Write about it")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Generated answer")).toBeInTheDocument();
    expect(screen.getByText("Sample answer written by the model - check it")).toBeInTheDocument();
    expect(screen.getByText("✎ Generated answer")).toBeInTheDocument();
  });

  it("renders grammar row with Generated badge and original text details", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[grammarGenerated]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} pageCount={5} />);

    expect(screen.getByDisplayValue("Present form")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Regular verbs")).toBeInTheDocument();
    expect(screen.getByText("✎ Generated")).toBeInTheDocument();

    const summary = screen.getByText("Original page text");
    expect(summary).toBeInTheDocument();

    const details = summary.closest("details");
    expect(details).toBeInTheDocument();
    await userEvent.click(summary);

    expect(screen.getByText("Present form text")).toBeInTheDocument();
  });

  it("page panel is shown when pageCount is provided", () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[grammar, exerciseGenerated]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} pageCount={5} />);

    expect(screen.getByAltText(/Page.*of the document/)).toBeInTheDocument();
    expect(screen.getByText("Page 3 / 5")).toBeInTheDocument();
  });

  it("focuses grammar row and updates page panel", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[grammar, grammarGenerated]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} pageCount={5} />);

    expect(screen.getByText("Page 3 / 5")).toBeInTheDocument();

    const row = screen.getByDisplayValue("Present form").closest("li");
    await userEvent.click(row!);

    expect(screen.getByText("Page 2 / 5")).toBeInTheDocument();
  });

  it("page panel prev/next buttons change displayed page", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[grammar, grammarGenerated]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} pageCount={5} />);

    const nextBtn = screen.getAllByRole("button", { name: /next/i })[0];
    await userEvent.click(nextBtn);
    expect(screen.getByText("Page 4 / 5")).toBeInTheDocument();

    const prevBtn = screen.getAllByRole("button", { name: /prev/i })[0];
    await userEvent.click(prevBtn);
    expect(screen.getByText("Page 3 / 5")).toBeInTheDocument();
  });

  it("edits the word type through the fixed list and shows the saved word beside a duplicate", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const dup: Candidate = {
      id: "v1", word: "水", translation: "water", phonetic: "shuǐ", word_type: "noun", quote: "水 water", page: 0, chunk_id: "c",
      status: "verified", min_conf: null, existing: { translation: "liquid", word_type: "noun" },
      flags: [{ code: "already_in_language", message: "exists", severity: "info" }],
    };
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[dup]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    expect(screen.getByText("Already saved in your language")).toBeInTheDocument();
    expect(screen.getByText("liquid")).toBeInTheDocument();
    const type = screen.getAllByRole("combobox")[0];
    expect(Array.from((type as HTMLSelectElement).options).map((o) => o.value)).toContain("classifier");
    await userEvent.selectOptions(type, "verb");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "merge");
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    expect(onAdd).toHaveBeenCalledWith({ items: [{ word: "水", translation: "water", phonetic: "shuǐ", word_type: "verb", on_conflict: "merge" }] });
  });

  it("offers the keep/merge/overwrite choice for calligraphy that already exists", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const cal: Candidate = {
      id: "k1", kind: "calligraphy", character: "水", meaning: "water", quote: "水", page: 0, chunk_id: "c", status: "verified", flags: [],
      min_conf: null, existing: { meaning: "liquid", strokes: 4 },
    };
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[cal]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    expect(screen.getByText("liquid")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox"), "overwrite");
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    expect(onAdd.mock.calls[0][0].elements[0].fields.on_conflict).toBe("overwrite");
  });

  it("shows the page panel with the original page and a toggle on small screens", async () => {
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[grammar]} addLabel={(n) => `Add ${n}`} onAdd={vi.fn()} pageCount={9} />);
    expect(screen.getByText("Page 3 / 9")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show the original page" }));
    expect(screen.getByRole("button", { name: "Hide the page" })).toBeInTheDocument();
  });
});
