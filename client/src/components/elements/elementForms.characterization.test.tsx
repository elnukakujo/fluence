// @vitest-environment jsdom
// Pins what the vocabulary, grammar and calligraphy forms do today, so the shared-shell extraction (Task 14, option B) cannot change it.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConflictError from "@/api/conflictError";

const m = vi.hoisted(() => ({
    push: vi.fn(), refresh: vi.fn(),
    createVocabulary: vi.fn(), updateVocabulary: vi.fn(),
    createGrammar: vi.fn(), updateGrammar: vi.fn(),
    createCalligraphy: vi.fn(), updateCalligraphy: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, refresh: m.refresh }) }));
vi.mock("@/api/vocabulary", () => ({ createVocabulary: m.createVocabulary, updateVocabulary: m.updateVocabulary }));
vi.mock("@/api/grammar", () => ({ createGrammar: m.createGrammar, updateGrammar: m.updateGrammar }));
vi.mock("@/api/calligraphy", () => ({ createCalligraphy: m.createCalligraphy, updateCalligraphy: m.updateCalligraphy }));
// the pickers and the media loader fetch their own data: stand-ins that expose just what the forms hand them
vi.mock("@/components/tags/tagSelector", () => ({ default: (p: { onTagsChange: (v: string[]) => void }) => <button type="button" onClick={() => p.onTagsChange(["tag_1"])}>pick tag</button> }));
vi.mock("@/components/sources/sourceSelector", () => ({ default: (p: { onSourcesChange: (v: string[]) => void }) => <button type="button" onClick={() => p.onSourcesChange(["src_1"])}>pick source</button> }));
vi.mock("@/components/media/mediaLoader", () => ({ default: () => null }));
vi.mock("@/components/ui/dialogs/conflictDialog", () => ({
    default: (p: { onKeep: () => void; onOverwrite: () => void; onManualResolve: (f: Record<string, string>) => void; onCancel: () => void }) => (
        <div role="dialog">
            <button type="button" onClick={p.onKeep}>keep</button>
            <button type="button" onClick={p.onOverwrite}>overwrite</button>
            <button type="button" onClick={() => p.onManualResolve({ translation: "merged" })}>manual</button>
            <button type="button" onClick={p.onCancel}>cancel</button>
        </div>
    ),
}));

import VocabularyForm from "./vocabularyForm";
import GrammarForm from "./grammarForm";
import CalligraphyForm from "./calligraphyForm";

const conflict = () => new ConflictError({ entity_type: "word", existing: { id: "word_1" }, incoming: {}, diff: [] });
// AutoWidthInput does not wire its label to its input (an existing accessibility gap), so a field is found by its visible label text
const field = (label: string) => screen.getByText(label, { selector: "label" }).parentElement!.querySelector("input, textarea") as HTMLElement;
const submitByName = (re: RegExp) => userEvent.click(screen.getByRole("button", { name: re }));
let alertSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/languages/lang_1/lesson/lesson_1/voc/new");   // the forms read the language id from the URL
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const f of [m.createVocabulary, m.updateVocabulary, m.createGrammar, m.updateGrammar, m.createCalligraphy, m.updateCalligraphy]) f.mockResolvedValue({ id: "new_1" });
});
afterEach(cleanup);

const WORD = { word: "水", translation: "water", word_type: "", word_gender: undefined, phonetic: undefined, image_files: [], audio_files: [] };

describe("vocabulary form", () => {
    it("creates, sends the payload with the lesson, then returns to the lesson", async () => {
        render(<VocabularyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Word *"), "水");
        await userEvent.type(field("Translation"), "water");
        await submitByName(/Add Vocabulary/);
        await waitFor(() => expect(m.createVocabulary).toHaveBeenCalledTimes(1));
        expect(m.createVocabulary).toHaveBeenCalledWith({ word: WORD, example_sentences: [], lesson_id: "lesson_1", tags: [], sources: [] }, undefined);
        expect(m.updateVocabulary).not.toHaveBeenCalled();
        await waitFor(() => expect(m.push).toHaveBeenCalledWith("/languages/lang_1/lesson/lesson_1"));
        expect(m.refresh).toHaveBeenCalled();
    });

    it("updates an existing vocabulary instead of creating", async () => {
        const existing = { id: "voc_1", lesson_id: "lesson_1", word: { ...WORD, word: "火" }, example_sentences: [], tags: [{ id: "tag_9" }], sources: [] };
        render(<VocabularyForm vocabulary={existing as never} lesson_id="lesson_1" />);
        await submitByName(/Update Vocabulary/);
        await waitFor(() => expect(m.updateVocabulary).toHaveBeenCalledTimes(1));
        expect(m.updateVocabulary).toHaveBeenCalledWith("voc_1", expect.objectContaining({ lesson_id: "lesson_1", tags: [{ id: "tag_9" }], word: expect.objectContaining({ word: "火" }) }));
        expect(m.createVocabulary).not.toHaveBeenCalled();
    });

    it("sends the picked tags and sources", async () => {
        render(<VocabularyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Word *"), "水");
        await userEvent.click(screen.getByText("pick tag"));
        await userEvent.click(screen.getByText("pick source"));
        await submitByName(/Add Vocabulary/);
        await waitFor(() => expect(m.createVocabulary).toHaveBeenCalled());
        expect(m.createVocabulary.mock.calls[0][0]).toMatchObject({ tags: [{ id: "tag_1" }], sources: [{ id: "src_1" }] });
    });

    it("adds and fills an example sentence", async () => {
        const { container } = render(<VocabularyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Word *"), "水");
        await userEvent.click(screen.getByRole("button", { name: /Add example sentence/i }));
        await userEvent.type(field("Example Sentence *"), "水を飲む");
        await submitByName(/Add Vocabulary/);
        await waitFor(() => expect(m.createVocabulary).toHaveBeenCalled());
        expect(m.createVocabulary.mock.calls[0][0].example_sentences).toEqual([{ text: "水を飲む", translation: "", image_files: [], audio_files: [] }]);
    });

    it("deleting an example sentence does not submit the form", async () => {
        const { container } = render(<VocabularyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Word *"), "水");
        await userEvent.click(screen.getByRole("button", { name: /Add example sentence/i }));
        await userEvent.type(field("Example Sentence *"), "水を飲む");
        await userEvent.click(container.querySelector("button.btn-danger") as HTMLElement);
        expect(screen.queryByText("Example Sentence *", { selector: "label" })).toBeNull();
        expect(m.createVocabulary).not.toHaveBeenCalled();
    });

    it("a failed save alerts and stays on the page", async () => {
        m.createVocabulary.mockRejectedValue(new Error("boom"));
        render(<VocabularyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Word *"), "水");
        await submitByName(/Add Vocabulary/);
        await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Failed to create vocabulary. Check console for details."));
        expect(m.push).not.toHaveBeenCalled();
    });

    it.each([["keep", "keep"], ["overwrite", "overwrite"]])("a duplicate opens the conflict dialog; %s resubmits with on_conflict=%s", async (button, mode) => {
        m.createVocabulary.mockRejectedValueOnce(conflict());
        render(<VocabularyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Word *"), "水");
        await submitByName(/Add Vocabulary/);
        await screen.findByRole("dialog");
        expect(m.push).not.toHaveBeenCalled();
        await userEvent.click(screen.getByText(button));
        await waitFor(() => expect(m.createVocabulary).toHaveBeenCalledTimes(2));
        expect(m.createVocabulary.mock.calls[1][1]).toBe(mode);
        await waitFor(() => expect(m.push).toHaveBeenCalledWith("/languages/lang_1/lesson/lesson_1"));
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("a manual resolution merges its fields into the word and resubmits with merge", async () => {
        m.createVocabulary.mockRejectedValueOnce(conflict());
        render(<VocabularyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Word *"), "水");
        await submitByName(/Add Vocabulary/);
        await screen.findByRole("dialog");
        await userEvent.click(screen.getByText("manual"));
        await waitFor(() => expect(m.createVocabulary).toHaveBeenCalledTimes(2));
        expect(m.createVocabulary.mock.calls[1][0].word).toMatchObject({ word: "水", translation: "merged" });
        expect(m.createVocabulary.mock.calls[1][1]).toBe("merge");
    });

    it("cancelling the dialog closes it without resubmitting", async () => {
        m.createVocabulary.mockRejectedValueOnce(conflict());
        render(<VocabularyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Word *"), "水");
        await submitByName(/Add Vocabulary/);
        await userEvent.click(await screen.findByText("cancel"));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(m.createVocabulary).toHaveBeenCalledTimes(1);
    });

    it("a failed conflict resolution alerts", async () => {
        m.createVocabulary.mockRejectedValueOnce(conflict()).mockRejectedValueOnce(new Error("boom"));
        render(<VocabularyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Word *"), "水");
        await submitByName(/Add Vocabulary/);
        await userEvent.click(await screen.findByText("keep"));
        await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Failed to resolve conflict. Check console for details."));
    });
});

describe("grammar form", () => {
    const fill = async () => {
        await userEvent.type(field("Title *"), "て-form");
        await userEvent.type(field("Explanation *"), "joins verbs");
    };

    it("creates without a conflict argument, then returns to the lesson", async () => {
        render(<GrammarForm lesson_id="lesson_1" />);
        await fill();
        await submitByName(/Add Grammar/);
        await waitFor(() => expect(m.createGrammar).toHaveBeenCalledTimes(1));
        expect(m.createGrammar).toHaveBeenCalledWith({ title: "て-form", explanation: "joins verbs", example_sentences: [], lesson_id: "lesson_1", tags: [], sources: [] });
        await waitFor(() => expect(m.push).toHaveBeenCalledWith("/languages/lang_1/lesson/lesson_1"));
        expect(m.refresh).toHaveBeenCalled();
    });

    it("updates an existing grammar point", async () => {
        render(<GrammarForm grammar={{ id: "gram_1", title: "a", explanation: "b", example_sentences: [], lesson_id: "lesson_1" } as never} lesson_id="lesson_1" />);
        await submitByName(/Update Grammar/);
        await waitFor(() => expect(m.updateGrammar).toHaveBeenCalledWith("gram_1", expect.objectContaining({ title: "a", explanation: "b" })));
        expect(m.createGrammar).not.toHaveBeenCalled();
    });

    it("sends the picked tags and sources and a filled example sentence", async () => {
        const { container } = render(<GrammarForm lesson_id="lesson_1" />);
        await fill();
        await userEvent.click(screen.getByText("pick tag"));
        await userEvent.click(screen.getByText("pick source"));
        await userEvent.click(screen.getByRole("button", { name: /Add example sentence/i }));
        await userEvent.type(field("Example Sentence *"), "食べて");
        await submitByName(/Add Grammar/);
        await waitFor(() => expect(m.createGrammar).toHaveBeenCalled());
        expect(m.createGrammar.mock.calls[0][0]).toMatchObject({ tags: [{ id: "tag_1" }], sources: [{ id: "src_1" }], example_sentences: [{ text: "食べて", translation: "", image_files: [], audio_files: [] }] });
    });

    it("deleting an example sentence does not submit the form", async () => {
        const { container } = render(<GrammarForm lesson_id="lesson_1" />);
        await fill();
        await userEvent.click(screen.getByRole("button", { name: /Add example sentence/i }));
        await userEvent.type(field("Example Sentence *"), "食べて");
        await userEvent.click(container.querySelector("button.btn-danger") as HTMLElement);
        expect(screen.queryByText("Example Sentence *", { selector: "label" })).toBeNull();
        expect(m.createGrammar).not.toHaveBeenCalled();
    });

    it("a failed save alerts and stays on the page", async () => {
        m.createGrammar.mockRejectedValue(new Error("boom"));
        render(<GrammarForm lesson_id="lesson_1" />);
        await fill();
        await submitByName(/Add Grammar/);
        await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Failed to create grammar. Check console for details."));
        expect(m.push).not.toHaveBeenCalled();
    });
});

describe("calligraphy form", () => {
    const CHAR = { character: "水", phonetic: "", meaning: undefined, radical: undefined, strokes: undefined, image_files: [], audio_files: [] };

    it("creates, sends the payload, then returns to the lesson", async () => {
        render(<CalligraphyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Character *"), "水");
        await submitByName(/Add Calligraphy/);
        await waitFor(() => expect(m.createCalligraphy).toHaveBeenCalledTimes(1));
        expect(m.createCalligraphy).toHaveBeenCalledWith({ character: CHAR, example_words: [], example_sentences: [], lesson_id: "lesson_1", tags: [], sources: [] }, undefined);
        await waitFor(() => expect(m.push).toHaveBeenCalledWith("/languages/lang_1/lesson/lesson_1"));
        expect(m.refresh).toHaveBeenCalled();
    });

    it("updates an existing calligraphy", async () => {
        render(<CalligraphyForm calligraphy={{ id: "call_1", lesson_id: "lesson_1", character: { ...CHAR, character: "火" }, example_words: [], example_sentences: [] } as never} lesson_id="lesson_1" />);
        await submitByName(/Update Calligraphy/);
        await waitFor(() => expect(m.updateCalligraphy).toHaveBeenCalledWith("call_1", expect.objectContaining({ character: expect.objectContaining({ character: "火" }) })));
        expect(m.createCalligraphy).not.toHaveBeenCalled();
    });

    it("sends the picked tags and sources, an example word and an example sentence", async () => {
        render(<CalligraphyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Character *"), "水");
        await userEvent.click(screen.getByText("pick tag"));
        await userEvent.click(screen.getByText("pick source"));
        await userEvent.click(screen.getByRole("button", { name: /Add Example Word/i }));
        await userEvent.type(field("Example Word *"), "水道");
        await userEvent.click(screen.getByRole("button", { name: /Add Example Sentence/i }));
        await userEvent.type(field("Example Sentence *"), "水を飲む");
        await submitByName(/Add Calligraphy/);
        await waitFor(() => expect(m.createCalligraphy).toHaveBeenCalled());
        const sent = m.createCalligraphy.mock.calls[0][0];
        expect(sent).toMatchObject({ tags: [{ id: "tag_1" }], sources: [{ id: "src_1" }] });
        expect(sent.example_words).toEqual([expect.objectContaining({ word: "水道", word_type: "noun" })]);
        expect(sent.example_sentences).toEqual([{ text: "水を飲む", translation: "", image_files: [], audio_files: [] }]);
    });

    it("deleting an example sentence does not submit the form", async () => {
        const { container } = render(<CalligraphyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Character *"), "水");
        await userEvent.click(screen.getByRole("button", { name: /Add Example Sentence/i }));
        await userEvent.click(container.querySelector("button.btn-danger") as HTMLElement);
        expect(screen.queryByText("Example Sentence *", { selector: "label" })).toBeNull();
        expect(m.createCalligraphy).not.toHaveBeenCalled();
    });

    it("a failed save alerts and stays on the page", async () => {
        m.createCalligraphy.mockRejectedValue(new Error("boom"));
        render(<CalligraphyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Character *"), "水");
        await submitByName(/Add Calligraphy/);
        await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Failed to create calligraphy. Check console for details."));
        expect(m.push).not.toHaveBeenCalled();
    });

    it("a duplicate opens the dialog; keep resubmits with on_conflict=keep; manual merges into the character", async () => {
        m.createCalligraphy.mockRejectedValueOnce(conflict()).mockRejectedValueOnce(conflict());
        render(<CalligraphyForm lesson_id="lesson_1" />);
        await userEvent.type(field("Character *"), "水");
        await submitByName(/Add Calligraphy/);
        await userEvent.click(await screen.findByText("keep"));
        await waitFor(() => expect(m.createCalligraphy).toHaveBeenCalledTimes(2));
        expect(m.createCalligraphy.mock.calls[1][1]).toBe("keep");
        // the second attempt conflicts again (mockRejectedValueOnce twice): the dialog is back, resolve manually this time
        // (a failed resolution alerts rather than reopening, so submit afresh)
        await waitFor(() => expect(alertSpy).toHaveBeenCalled());
        m.createCalligraphy.mockRejectedValueOnce(conflict());
        await submitByName(/Add Calligraphy/);
        await userEvent.click(await screen.findByText("manual"));
        await waitFor(() => expect(m.createCalligraphy.mock.calls.at(-1)?.[1]).toBe("merge"));
        expect(m.createCalligraphy.mock.calls.at(-1)?.[0].character).toMatchObject({ character: "水", translation: "merged" });
    });
});
