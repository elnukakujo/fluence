// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { forgetVisit, popBackTarget, recordVisit } from "./navHistory";

const visit = (...paths: string[]) => paths.forEach(recordVisit);
beforeEach(() => sessionStorage.clear());

describe("navHistory", () => {
    it("goes back to the last page visited, not the URL's parent", () => {
        visit("/tags", "/languages/l1/lesson/x/voc", "/sources");
        expect(popBackTarget("/sources")).toBe("/languages/l1/lesson/x/voc");
    });

    it("keeps walking back on repeated presses", () => {
        visit("/a", "/b", "/c");
        expect(popBackTarget("/c")).toBe("/b");
        recordVisit("/b");   // arriving on /b records it
        expect(popBackTarget("/b")).toBe("/a");
    });

    it("skips the current page (reload, repeated record) and forms", () => {
        visit("/lesson", "/lesson/voc/new", "/lesson/voc");
        recordVisit("/lesson/voc");
        expect(popBackTarget("/lesson/voc")).toBe("/lesson");
    });

    it("never returns to a page forgotten as invalid", () => {
        visit("/a", "/gone", "/b");
        forgetVisit("/gone");
        expect(popBackTarget("/b")).toBe("/a");
    });

    it("returns null with no history, so the caller can use the parent path", () => {
        visit("/only");
        expect(popBackTarget("/only")).toBeNull();
    });
});
