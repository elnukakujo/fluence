// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getQueue: vi.fn(), getLessonCards: vi.fn() }));
const shell = vi.hoisted(() => vi.fn<(p: unknown) => null>(() => null));
vi.mock("@/api/review", async (orig) => ({ ...(await orig<typeof import("@/api/review")>()), ...api }));
vi.mock("@/components/review/ReviewSession", () => ({ default: shell }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k }));

import QueuePage from "@/app/languages/[language_id]/review/queue/page";
import DailyPage from "@/app/languages/[language_id]/review/page";
import VocPage from "@/app/languages/[language_id]/lesson/[lesson_id]/voc/flashcard/page";
import GramPage from "@/app/languages/[language_id]/lesson/[lesson_id]/gram/flashcard/page";
import CallPage from "@/app/languages/[language_id]/lesson/[lesson_id]/call/flashcard/page";
import { scopeFromQuery } from "@/utils/reviewScope";

const items = [{ id: "voc_1" }];
const lastProps = () => shell.mock.calls.at(-1)![0] as { items: unknown; options: Record<string, unknown> };

beforeEach(() => { vi.clearAllMocks(); api.getQueue.mockResolvedValue(items); api.getLessonCards.mockResolvedValue(items); });

describe("every entry point mounts the one shell with only {items, options}", () => {
  const cases: [string, () => Promise<React.ReactElement>][] = [
    ["lesson vocabulary", async () => VocPage({ params: Promise.resolve({ language_id: "l1", lesson_id: "ls1" }) })],
    ["lesson grammar", async () => GramPage({ params: Promise.resolve({ language_id: "l1", lesson_id: "ls1" }) })],
    ["lesson calligraphy", async () => CallPage({ params: Promise.resolve({ language_id: "l1", lesson_id: "ls1" }) })],
    ["tag", async () => QueuePage({ params: Promise.resolve({ language_id: "l1" }), searchParams: Promise.resolve({ scope: "tag", tag_id: "tag_1" }) })],
    ["source", async () => QueuePage({ params: Promise.resolve({ language_id: "l1" }), searchParams: Promise.resolve({ scope: "source", source_id: "src_1" }) })],
    ["type", async () => QueuePage({ params: Promise.resolve({ language_id: "l1" }), searchParams: Promise.resolve({ scope: "type", type: "character", radicals: "1" }) })],
    ["free", async () => QueuePage({ params: Promise.resolve({ language_id: "l1" }), searchParams: Promise.resolve({ scope: "free", ids: "voc_1,gram_2" }) })],
    ["daily", async () => DailyPage({ params: Promise.resolve({ language_id: "l1" }) })],
  ];
  it.each(cases)("%s", async (_name, page) => {
    render(await page());
    expect(Object.keys(lastProps()).sort()).toEqual(["items", "options"]);
    expect(lastProps().options.languageId).toBe("l1");
  });
});

describe("scope from the URL", () => {
  it("passes each scope's own id to the server", async () => {
    render(await QueuePage({ params: Promise.resolve({ language_id: "l1" }), searchParams: Promise.resolve({ scope: "free", ids: "voc_1,gram_2" }) }));
    expect(api.getQueue).toHaveBeenCalledWith("l1", { scope: "free", ids: ["voc_1", "gram_2"] });
  });
  it("falls back to the daily queue when the scope or its id is missing or unknown", () => {
    for (const q of [{}, { scope: "lesson" }, { scope: "nope", lesson_id: "x" }, { scope: "free", ids: "" }]) {
      expect(scopeFromQuery(q)).toEqual({ scope: "daily" });
    }
  });
});
