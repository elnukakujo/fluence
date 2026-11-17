// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", async () => ({ useTranslations: (await import("@/test/intlMock")).translator }));
import ThemeToggle from "./themeToggle";

const systemDark = (dark: boolean) =>
	(window.matchMedia = vi.fn().mockReturnValue({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never);

describe("ThemeToggle", () => {
	beforeEach(() => { delete document.documentElement.dataset.theme; document.cookie = "theme=; path=/; max-age=0"; });

	it("follows a dark system, picks light, then goes back to the system", () => {
		systemDark(true);
		render(<ThemeToggle />);
		fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
		expect(document.documentElement.dataset.theme).toBe("light");
		expect(document.cookie).toContain("theme=light");
		fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
		expect(document.documentElement.dataset.theme).toBeUndefined();
		expect(document.cookie).not.toContain("theme=");
	});
});
