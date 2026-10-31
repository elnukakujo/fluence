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
});
