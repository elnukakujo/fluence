// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReviewPanel from "./reviewPanel";
import type { Candidate } from "@/lib/ingestion/review";

vi.mock("@/api/ingestion", () => ({ pageImageUrl: () => "/x.png" }));

const grammar: Candidate = {
  id: "g1", kind: "grammar", title: "Te-form", explanation: "Connects verbs", example_sentences: ["Tabete iru."],
  quote: "te-form", page: 2, chunk_id: "c", status: "flagged", flags: [], min_conf: null,
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
});
