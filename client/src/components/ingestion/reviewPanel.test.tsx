// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReviewPanel from "./reviewPanel";
import type { Candidate } from "@/lib/ingestion/review";

const uploadMedia = vi.hoisted(() => vi.fn());
vi.mock("@/api/ingestion", () => ({ pageImageUrl: () => "/x.png", uploadMedia }));

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

  it("Keep existing deletes the new item and Undo brings it back", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const cal: Candidate = {
      id: "k1", kind: "calligraphy", character: "水", meaning: "water", quote: "水", page: 0, chunk_id: "c", status: "verified", flags: [],
      min_conf: null, existing: { meaning: "liquid", strokes: 4 },
    };
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[cal]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Keep existing" }));
    expect(screen.getByText(/Kept your existing one/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add 0" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    expect(onAdd.mock.calls[0][0].elements[0].fields.on_conflict).toBe("keep");
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

  const spoken: Candidate = {
    id: "sp", kind: "exercise", exercise_type: "speaking", question: "Say 你好", answer: "Say 你好", quote: "Say", page: 0, chunk_id: "c",
    status: "verified", flags: [], min_conf: null, audio_lines: ["Say 你好", "再说一遍"],
    image_crop: { page: 0, bbox: [0, 100, 100, 140], page_size: [200, 400], has_picture: true },
  };

  it("offers the detected picture and the spoken lines, and sends the TTS choice with the media", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[spoken]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} canGenerateAudio />);
    expect(screen.getByRole("img", { name: "Cropped picture from the page" })).toBeInTheDocument();
    expect(screen.getByText("再说一遍")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Make the 2 missing audio clips/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    const media = onAdd.mock.calls[0][0].elements[0].media;
    expect(media.image.crop.bbox).toEqual([0, 100, 100, 140]);
    expect(media.audio).toEqual({ lines: ["Say 你好", "再说一遍"], uploads: {}, tts: true });
  });

  it("cannot turn TTS on without an endpoint, and a replaced clip is no longer counted", async () => {
    uploadMedia.mockResolvedValue({ id: "c.wav", kind: "audio" });
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPanel jobId="j" filename="b.pdf" candidates={[spoken]} addLabel={(n) => `Add ${n}`} onAdd={onAdd} />);
    expect(screen.getByRole("checkbox", { name: /Make the 2 missing audio clips/ })).toBeDisabled();
    expect(screen.getByText(/Add a text-to-speech endpoint in Settings/)).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText("Replace the audio of line 1"), new File(["x"], "mine.wav", { type: "audio/wav" }));
    expect(await screen.findByText(/mine\.wav/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Make the 1 missing audio clip / })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
    expect(onAdd.mock.calls[0][0].elements[0].media.audio.uploads).toEqual({ 0: "c.wav" });
  });
});
