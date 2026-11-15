// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type Passage from "@/interface/components/Passage";

vi.mock("@/components/media/mediaLoader", () => ({ default: () => null }));

import ExampleSentencesEditor from "./exampleSentencesEditor";

const labels = { sentence: "Example Sentence", translation: "Example Sentence Translation" };
function Harness({ initial = [], addLabel }: { initial?: Partial<Passage>[]; addLabel?: string }) {
    const [s, setS] = useState<Partial<Passage>[]>(initial);
    return <form><ExampleSentencesEditor heading="Sentences" labels={labels} sentences={s} setSentences={setS} addLabel={addLabel} /></form>;
}

describe("ExampleSentencesEditor accessibility", () => {
    it("names the icon-only add and remove buttons", async () => {
        render(<Harness />);
        const add = screen.getByRole("button", { name: "Add example sentence" });
        await userEvent.click(add);
        expect(screen.getByRole("button", { name: "Remove example sentence" })).toBeInTheDocument();
    });

    it("every button is type=button (a form must not submit from the editor) and a 44px target", async () => {
        render(<Harness initial={[{ text: "a", translation: "", image_files: [], audio_files: [] }]} />);
        for (const b of screen.getAllByRole("button")) {
            expect(b).toHaveAttribute("type", "button");
            expect(b.className).toMatch(/min-h-11/);
            expect(b.className).toMatch(/min-w-11/);
        }
    });

    it("a visible add label is the button's name (no hidden duplicate label)", () => {
        render(<Harness addLabel="Add Example Sentence" />);
        expect(screen.getByRole("button", { name: "Add Example Sentence" })).toBeInTheDocument();
    });

    it("hides the decorative icons from assistive tech", () => {
        const { container } = render(<Harness initial={[{ text: "a", translation: "", image_files: [], audio_files: [] }]} />);
        for (const svg of container.querySelectorAll("button svg")) expect(svg).toHaveAttribute("aria-hidden", "true");
    });

    it("rows keep their text labels wired to their inputs", () => {
        render(<Harness initial={[{ text: "a", translation: "t", image_files: [], audio_files: [] }]} />);
        expect(screen.getByLabelText(/^Example Sentence \*/)).toHaveValue("a");
        expect(screen.getByLabelText("Example Sentence Translation")).toHaveValue("t");
    });
});
