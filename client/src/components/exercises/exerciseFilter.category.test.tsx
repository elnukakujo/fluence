// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: nav.replace }), usePathname: () => "/ex", useSearchParams: () => new URLSearchParams(nav.search) }));

import ExerciseFilter from "./exerciseFilter";
import { getExamCategories } from "@/utils/language_iso639";

beforeEach(() => { vi.clearAllMocks(); nav.search = ""; });

describe("exercise filter: category", () => {
  it("writes ?category= when a section is picked", async () => {
    render(<ExerciseFilter types={["essay"]} categories={getExamCategories("jpn")} />);
    await userEvent.click(screen.getByRole("button", { name: /Filters/ }));
    await userEvent.click(screen.getByRole("button", { name: "Reading comprehension" }));
    expect(nav.replace).toHaveBeenCalledWith("/ex?category=reading");
  });

  it("an unknown category in the URL still counts as an active filter that Clear removes", async () => {
    nav.search = "category=old-slug";
    render(<ExerciseFilter types={[]} categories={getExamCategories("jpn")} />);
    await userEvent.click(screen.getByRole("button", { name: /Filters/ }));
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(nav.replace).toHaveBeenCalledWith("/ex");
  });
});
