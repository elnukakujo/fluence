// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReviewPanel from "./reviewPanel";
import type { Candidate } from "@/lib/ingestion/review";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const mergeGrammar = vi.hoisted(() => vi.fn());
vi.mock("@/api/ingestion", () => ({ pageImageUrl: () => "/x.png", mergeGrammar }));

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

    expect(screen.getByText("Te-form")).toBeInTheDocument();
    // flagged => unconfirmed: add disabled until the user confirms it
    const add = screen.getByRole("button", { name: "Add 0" });
    expect(add).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));

    expect(onAdd).toHaveBeenCalledWith({
      items: [],
      elements: [{ kind: "grammar", fields: { title: "Te-form", explanation: "Connects verbs", example_sentences: ["Tabete iru."] } }],
    });
  });

  it("shows the whole explanation as rendered markdown without clicking Edit", async () => {
    const md = { ...grammar, explanation: "- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |" };
    render(<ReviewPanel jobId="j" filename="b" candidates={[md]} addLabel={(n) => `Add ${n}`} onAdd={vi.fn()} />);
    expect(screen.getAllByRole("listitem").map((l) => l.textContent)).toEqual(expect.arrayContaining(["one", "two"]));
    expect(screen.getByRole("table")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const box = screen.getByDisplayValue(/- one/);
    expect(screen.queryByRole("table")).toBeNull();           // preview hidden while editing
    await userEvent.clear(box);
    await userEvent.type(box, "**bold**");
    await userEvent.click(screen.getByRole("button", { name: "Done editing" }));
    expect(screen.getByText("bold").tagName).toBe("STRONG");  // back after editing
  });

  it("sends edits the user made to the grammar fields", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="b" candidates={[{ ...grammar, status: "verified" }]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const title = screen.getByDisplayValue("Te-form");
    await userEvent.clear(title);
    await userEvent.type(title, "Te form 2");
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    expect(onAdd.mock.calls[0][0].elements[0].fields.title).toBe("Te form 2");
  });

  it("renders an exercise candidate and sends it in `elements` once selected", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[exercise]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);

    expect(screen.getByText("What is this?")).toBeInTheDocument();
    // verified => pre-confirmed, add enabled
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

    expect(screen.getByText("Write about it")).toBeInTheDocument();
    expect(screen.getByText("Sample answer written by the model - check it")).toBeInTheDocument();
    expect(screen.getByText("✎ Generated answer")).toBeInTheDocument();
  });

  it("renders a content-needs-fixing badge for content_invalid", async () => {
    const bad: Candidate = { ...exerciseGenerated, id: "e3", exercise_type: "quizz", content: null,
      flags: [{ code: "content_invalid", message: "content for quizz must be ...", severity: "warning" }] };
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[bad]} addLabel={(n) => `Add ${n}`} onAdd={vi.fn()} />);
    expect(screen.getByText("⚠ Content needs fixing")).toBeInTheDocument();
  });

  it("renders grammar row with Generated badge and original text details", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[grammarGenerated]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} range={[1, 5]} />);

    expect(screen.getByText("Present form")).toBeInTheDocument();
    expect(screen.getByText("✎ Generated")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByDisplayValue("Regular verbs")).toBeInTheDocument();

    const summary = screen.getByText("Original page text");
    expect(summary).toBeInTheDocument();

    const details = summary.closest("details");
    expect(details).toBeInTheDocument();
    await userEvent.click(summary);

    expect(screen.getByText("Present form text")).toBeInTheDocument();
  });

  it("page panel is shown with a range", () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[grammar, exerciseGenerated]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} range={[1, 5]} />);

    expect(screen.getByAltText(/Page.*of the document/)).toBeInTheDocument();
    expect(screen.getByText("Page 3 (1-5)")).toBeInTheDocument();
  });

  it("focuses grammar row and updates page panel", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[grammar, grammarGenerated]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} range={[1, 5]} />);

    expect(screen.getByText("Page 3 (1-5)")).toBeInTheDocument();

    const row = screen.getByText("Present form").closest("li");
    await userEvent.click(row!);

    expect(screen.getByText("Page 2 (1-5)")).toBeInTheDocument();
  });

  it("page panel prev/next buttons change displayed page", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="book.pdf" candidates={[grammar, grammarGenerated]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} range={[1, 5]} />);

    const nextBtn = screen.getAllByRole("button", { name: /next/i })[0];
    await userEvent.click(nextBtn);
    expect(screen.getByText("Page 4 (1-5)")).toBeInTheDocument();

    const prevBtn = screen.getAllByRole("button", { name: /prev/i })[0];
    await userEvent.click(prevBtn);
    expect(screen.getByText("Page 3 (1-5)")).toBeInTheDocument();
  });

  it("edits the word type through the fixed list and keeps the saved word beside a duplicate", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const dup: Candidate = {
      id: "v1", word: "水", translation: "water", phonetic: "shuǐ", word_type: "noun", quote: "水 water", page: 0, chunk_id: "c",
      status: "verified", min_conf: null, existing: { translation: "liquid", word_type: "noun" },
      flags: [{ code: "already_in_language", message: "exists", severity: "info" }],
    };
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[dup]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    expect(screen.getByText("Already saved")).toBeInTheDocument();
    expect(screen.getByText("liquid")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const type = screen.getByRole("combobox", { name: /type/i });
    expect(Array.from((type as HTMLSelectElement).options).map((o) => o.value)).toContain("classifier");
    await userEvent.selectOptions(type, "verb");
    await userEvent.click(screen.getByRole("button", { name: "Overwrite" }));
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    expect(onAdd).toHaveBeenCalledWith({ items: [{ word: "水", translation: "water", phonetic: "shuǐ", word_type: "verb", on_conflict: "overwrite" }] });
  });

  it("Keep existing still adds the item to the lesson, using the saved character unchanged", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const cal: Candidate = {
      id: "k1", kind: "calligraphy", character: "水", meaning: "water", quote: "水", page: 0, chunk_id: "c", status: "verified", flags: [],
      min_conf: null, existing: { meaning: "liquid", strokes: 4 },
    };
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[cal]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Keep existing" }));
    expect(screen.getByRole("button", { name: "Keep existing" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    expect(onAdd.mock.calls[0][0].elements[0].fields.on_conflict).toBe("keep");
  });

  it("a conflicting card needs a visible choice before it can be confirmed or sent", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const cal: Candidate = {
      id: "k1", kind: "calligraphy", character: "水", meaning: "water", quote: "水", page: 0, chunk_id: "c", status: "verified", flags: [],
      min_conf: null, existing: { meaning: "liquid", strokes: 4, in_lesson: false },
    };
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[cal]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(screen.getByText(/saved but is in no lesson/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add 0" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Overwrite" }));
    expect(screen.getByRole("button", { name: "Overwrite" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Keep existing" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    expect(onAdd.mock.calls[0][0].elements[0].fields).toMatchObject({ meaning: "water", on_conflict: "overwrite" });
  });

  it("Merge opens an editor and sends the user's own version as an overwrite", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const cal: Candidate = {
      id: "k1", kind: "calligraphy", character: "水", meaning: "water", quote: "水", page: 0, chunk_id: "c", status: "verified", flags: [],
      min_conf: null, existing: { meaning: "liquid", strokes: 4 },
    };
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[cal]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Merge…" }));
    const meaning = screen.getByRole("textbox", { name: "Result meaning" });
    await userEvent.clear(meaning);
    await userEvent.type(meaning, "water, liquid");
    await userEvent.click(screen.getByRole("button", { name: "Use this version" }));
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    expect(onAdd.mock.calls[0][0].elements[0].fields).toMatchObject({ meaning: "water, liquid", on_conflict: "overwrite" });
  });

  it("Delete removes an item from the count and from what is sent", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[exercise]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Add 0" })).toBeDisabled();
    expect(screen.getByText(/0 found/)).toBeInTheDocument();
  });

  it("splits items into tabs with counts and shows one kind at a time", async () => {
    const vocab: Candidate = { id: "v", word: "水", translation: "water", quote: "水", page: 0, chunk_id: "c", status: "verified", flags: [], min_conf: null };
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[vocab, grammar, exercise]} addLabel={(n) => `Add ${n}`} onAdd={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Vocabulary 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Grammar 1" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Calligraphy/ })).toBeNull();
    expect(screen.queryByText("Te-form")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Grammar 1" }));
    expect(screen.getByText("Te-form")).toBeInTheDocument();
  });

  it("Confirm all verified confirms only the verified items of the open tab", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const a: Candidate = { id: "a", word: "a", translation: "x", quote: "a", page: 0, chunk_id: "c", status: "flagged", flags: [], min_conf: null };
    const b: Candidate = { ...a, id: "b", word: "b", status: "verified" };
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[a, b]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirm all verified" }));
    expect(screen.getByRole("button", { name: "Add 1" })).toBeInTheDocument();
  });

  it("select all + Confirm / Reject in the toolbar act on the open tab only", async () => {
    const a: Candidate = { id: "a", word: "a", translation: "x", quote: "a", page: 0, chunk_id: "c", status: "flagged", flags: [], min_conf: null };
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[a, { ...a, id: "b", word: "b" }, grammar]} addLabel={(n) => `Add ${n}`} onAdd={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Select all/ }));
    const bar = () => within(screen.getByRole("region", { name: "Actions for the selected items" }));
    await userEvent.click(bar().getByRole("button", { name: "Confirm" }));
    expect(screen.getByRole("button", { name: "Add 2" })).toBeInTheDocument();   // the grammar card is in another tab
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Select all/ }));
    await userEvent.click(bar().getByRole("button", { name: "Reject" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject 2" }));   // the confirmation dialog
    expect(screen.getByRole("button", { name: "Add 0" })).toBeDisabled();
  });

  it("shows the page panel with the original page and a toggle on small screens", async () => {
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[grammar]} addLabel={(n) => `Add ${n}`} onAdd={vi.fn()} range={[1, 9]} />);
    expect(screen.getByText("Page 3 (1-9)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show the original page" }));
    expect(screen.getByRole("button", { name: "Hide the page" })).toBeInTheDocument();
  });

  it("says on the card whether it is confirmed, and Undo confirm takes it back", async () => {
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[grammar]} addLabel={(n) => `Add ${n}`} onAdd={vi.fn()} />);
    expect(screen.getByText(/To confirm - not added yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByText(/Confirmed - will be added/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo confirm" }));
    expect(screen.getByText(/To confirm - not added yet/)).toBeInTheDocument();
  });

  it("sends exactly what the user kept: deleted items of every kind never reach onAdd", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const v = (id: string, word: string): Candidate => ({ id, word, translation: "t", quote: word, page: 0, chunk_id: "c", status: "verified", flags: [], min_conf: null });
    const cal: Candidate = { id: "k1", kind: "calligraphy", character: "水", meaning: "water", quote: "水", page: 0, chunk_id: "c", status: "verified", flags: [], min_conf: null };
    const all = [v("v1", "alpha"), v("v2", "beta"), { ...grammar, status: "verified" as const }, cal, exercise];
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={all} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]); // alpha
    await userEvent.click(screen.getByRole("tab", { name: /Grammar/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("tab", { name: /Exercises/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Add 2" }));
    const sent = onAdd.mock.calls[0][0];
    expect(sent.items.map((i: { word: string }) => i.word)).toEqual(["beta"]);
    expect(sent.elements.map((e: { kind: string }) => e.kind)).toEqual(["calligraphy"]);
  });

  describe("bulk selection", () => {
    const g = (id: string, title: string, page: number): Candidate => ({ ...grammar, id, title, explanation: `${title} text`, original_text: `orig ${title}`, page });
    const three = [g("g1", "One", 1), g("g2", "Two", 2), g("g3", "Three", 3)];
    const open = async () => {
      render(<ReviewPanel jobId="j" filename="b" candidates={three} addLabel={(n) => `Add ${n}`} onAdd={vi.fn()} />);
      await userEvent.click(screen.getByRole("button", { name: "Select" }));
    };

    it("select all shows the bar; Confirm confirms the ticked cards", async () => {
      await open();
      await userEvent.click(screen.getByRole("checkbox", { name: /Select all/ }));
      expect(screen.getByRole("region", { name: "Actions for the selected items" })).toBeInTheDocument();
      await userEvent.click(within(screen.getByRole("region", { name: "Actions for the selected items" })).getByRole("button", { name: "Confirm" }));
      expect(screen.getByRole("button", { name: "Add 3" })).toBeInTheDocument();
    });

    it("Merge is disabled with one ticked card and joins two through the model", async () => {
      mergeGrammar.mockResolvedValue({ title: "Joined", explanation: "Joined text", example_sentences: [] });
      await open();
      await userEvent.click(screen.getByRole("checkbox", { name: "Select One" }));
      const bar = () => screen.getByRole("region", { name: "Actions for the selected items" });
      expect(within(bar()).getByRole("button", { name: "Merge" })).toBeDisabled();
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Two" }));
      await userEvent.click(within(bar()).getByRole("button", { name: "Merge" }));
      expect(mergeGrammar).toHaveBeenCalledWith("j", [
        { title: "One", explanation: "One text", original_text: "orig One" }, { title: "Two", explanation: "Two text", original_text: "orig Two" }]);
      expect(await screen.findByText("Joined")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(2);   // the two sources, undoable
    });

    it("a failed merge leaves the rows untouched and says why", async () => {
      mergeGrammar.mockRejectedValue(new Error("model down"));
      await open();
      await userEvent.click(screen.getByRole("checkbox", { name: /Select all/ }));
      await userEvent.click(within(screen.getByRole("region", { name: "Actions for the selected items" })).getByRole("button", { name: "Merge" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("model down");
      expect(screen.getByText("Three")).toBeInTheDocument();
    });
  });
});
