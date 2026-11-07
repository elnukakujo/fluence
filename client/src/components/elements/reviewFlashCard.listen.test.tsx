// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCard } from "@/api/review";

vi.mock("@/api/process", () => ({ updateScoreById: vi.fn().mockResolvedValue({}) }));
vi.mock("@/api/calligraphy", () => ({ submitCalligraphyDrawing: vi.fn() }));
vi.mock("@/components/exercises/exerciseRunner", () => ({ default: () => <div /> }));
vi.mock("@/components/media/audioPlayer", () => ({ default: ({ src }: { src: string }) => <div data-testid="player">{src}</div> }));
vi.mock("@/utils/listenFirst", () => ({ isListenFirst: (c: { id: string }) => c.id === "voc_listen" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ language_id: "lang1" }), useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

import ReviewFlashCard from "./reviewFlashCard";

const voc = (id: string) => ({
    id, card_id: `${id}#front`, side: "front", created_at: "2026-01-01T00:00:00",
    word: { word: "猫", translation: "cat", phonetic: "māo", audio_files: ["/media/mao.mp3"] }, example_sentences: [],
    front_score: 30, front_difficulty: 0.5, back_score: 30, back_difficulty: 0.5, score: 30, difficulty: 0.5,
}) as unknown as ReviewCard;
const front = () => within(screen.getByText("Click to reveal").closest('[role="button"]') as HTMLElement);

beforeEach(() => vi.clearAllMocks());

describe("review card: listen first", () => {
    it("plays the clip instead of showing the word, until the card is flipped", async () => {
        render(<ReviewFlashCard cards={[voc("voc_listen")]} />);
        expect(front().getByText("Listen and recall")).toBeInTheDocument();
        expect(front().queryByText("猫")).toBeNull();
        expect(front().queryByTestId("player")).toBeNull();                       // the face is a click target: the player sits beside it
        expect(screen.getAllByTestId("player").some((p) => p.textContent === "/media/mao.mp3" && !p.closest('[role="button"]'))).toBe(true);
        await userEvent.click(screen.getByText("Click to reveal"));
        expect(screen.getAllByText("猫").length).toBeGreaterThan(0);
    });

    it("any other card shows its word and not the listen prompt", () => {
        render(<ReviewFlashCard cards={[voc("voc_plain")]} />);
        expect(front().getByText("猫")).toBeInTheDocument();
        expect(screen.queryByText("Listen and recall")).toBeNull();
    });
});
