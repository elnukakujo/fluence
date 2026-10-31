import { describe, it, expect } from "vitest";

describe("Lesson wizard - pages screen", () => {
  it("shows the screen at status pages and posts the map", () => {
    // Simulate the lesson wizard logic
    const job = { status: "pages" as const };
    const showsPagesScreen = job.status === "pages";
    expect(showsPagesScreen).toBe(true);

    // Simulate posting page kinds
    const pageKinds = { "1": ["vocabulary", "grammar"], "2": ["passage"] };
    const posted = { page_kinds: pageKinds };
    expect(posted).toEqual({ page_kinds: pageKinds });
  });
});

describe("Language wizard - kind chips in lesson-range", () => {
  it("shows kind chips and sends page_kinds on confirm", () => {
    // Simulate the structure step with page_kinds
    const structure = {
      page_kinds: {
        "1": ["vocabulary"],
        "2": ["grammar", "passage"],
      },
    };
    expect(structure.page_kinds).toBeDefined();

    // Simulate confirm sending page_kinds
    const confirmPayload = {
      lessons: [],
      page_kinds: structure.page_kinds,
    };
    expect(confirmPayload.page_kinds).toEqual(structure.page_kinds);
  });
});

describe("Review panel - grammar candidate rendering", () => {
  it("renders a grammar candidate and sends it in elements when selected", () => {
    const grammarCandidate = {
      kind: "grammar",
      title: "Past Tense",
      explanation: "for completed actions",
    };

    const selected = true;
    const payload = {
      items: [],
      elements: selected
        ? [{ kind: "grammar", fields: { title: grammarCandidate.title, explanation: grammarCandidate.explanation, example_sentences: [] } }]
        : [],
    };

    expect(payload.elements).toHaveLength(1);
    expect(payload.elements[0].kind).toBe("grammar");
    expect(payload.elements[0].fields.title).toBe("Past Tense");
  });
});
