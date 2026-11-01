// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const refresh = vi.fn();
let natives: string[] = [];
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (k: string) => (k === "suggested" ? "suggested" : "Language"),
}));
vi.mock("@/api/user", () => ({
  getUserById: async () => ({ preferences: { native_language_iso639_2: natives } }),
}));

import LocaleSwitcher from "./localeSwitcher";

const labels = () => screen.getAllByRole("option").map((o) => o.textContent);

describe("LocaleSwitcher", () => {
  beforeEach(() => refresh.mockClear());

  it("lists suggested locales first", async () => {
    natives = ["eng", "fra"];
    render(<LocaleSwitcher currentUserId="u1" />);
    await waitFor(() => expect(labels()[0]).toContain("suggested"));
    expect(labels()).toEqual(["English · suggested", "Français · suggested", "中文"]);
  });

  it("marks nothing when no native language is supported", async () => {
    natives = ["spa"];
    render(<LocaleSwitcher currentUserId="u1" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(labels()).toEqual(["English", "Français", "中文"]);
  });

  it("sets the cookie and refreshes on change", () => {
    render(<LocaleSwitcher currentUserId={null} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zh" } });
    expect(document.cookie).toContain("NEXT_LOCALE=zh");
    expect(refresh).toHaveBeenCalled();
  });
});
