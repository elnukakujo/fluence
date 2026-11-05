// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Vocabulary from "@/interface/features/Vocabulary";

const api = vi.hoisted(() => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/process", () => api);
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/api/language", () => ({ getLanguageById: vi.fn().mockResolvedValue({ target_iso639_2t: "jpn" }) }));

import VocabularyFlashCard from "./vocabularyFlashCard";

const voc = (side?: "front" | "back") =>
  ({ id: "voc_1", side, word: { word: "水", translation: "water" } }) as unknown as Vocabulary;

beforeEach(() => vi.clearAllMocks());

const faces = (c: HTMLElement) => ({
  inner: c.querySelector(".flashcard-inner") as HTMLElement,
  front: c.querySelector(".flashcard-face:not(.flashcard-face-back)") as HTMLElement,
  back: c.querySelector(".flashcard-face-back") as HTMLElement,
});

describe("two-sided vocabulary flashcard", () => {
  it("front side asks with the word and reveals the translation", async () => {
    const { container } = render(<VocabularyFlashCard vocabularies={[voc("front")]} />);
    const f = faces(container);
    expect(f.front).toHaveTextContent("水");
    expect(f.front).not.toHaveTextContent("water");
    await userEvent.click(f.front);
    expect(f.inner).toHaveClass("is-flipped");
    expect(f.back).toHaveTextContent("water");
  });

  it("back side asks with the translation and reveals the word", async () => {
    const { container } = render(<VocabularyFlashCard vocabularies={[voc("back")]} />);
    const f = faces(container);
    expect(f.front).toHaveTextContent("water");
    expect(f.front).not.toHaveTextContent("水");
    await userEvent.click(f.front);
    expect(f.back).toHaveTextContent("水");
  });

  it("grades with the item's side", async () => {
    const { container } = render(<VocabularyFlashCard vocabularies={[voc("back")]} />);
    await userEvent.click(faces(container).front);
    await userEvent.click(screen.getByText(/good/i));
    expect(api.updateScoreById).toHaveBeenCalledWith("voc_1", 0.75, expect.any(Number), true, undefined, "back");
  });
});
