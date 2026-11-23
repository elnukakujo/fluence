// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/studiedTypes", () => ({ getStudiedTypes: vi.fn().mockResolvedValue(["vocabulary", "grammar", "exercises"]) }));
vi.mock("./pagePanel", () => ({ default: () => null, pageImageUrl: () => "" }));

import PageKinds from "./pageKinds";

describe("page kinds of the parser (SG-14)", () => {
    it("does not offer a kind the course does not study", async () => {
        render(<PageKinds pages={[1]} value={{ 1: ["vocabulary"] }} onChange={() => {}} languageId="lang_1" />);
        await screen.findByRole("button", { name: /Vocabulary/i });
        await vi.waitFor(() => expect(screen.queryByRole("button", { name: /alligraph/i })).toBeNull());
        expect(screen.getByRole("button", { name: /Grammar/i })).toBeInTheDocument();
    });
});
