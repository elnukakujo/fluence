// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const refresh = vi.fn();
let natives: string[] = [];
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next-intl", async () => ({
  useLocale: () => "en",
  useTranslations: (await import("@/test/intlMock")).translator,
}));
vi.mock("@/api/user", () => ({
  getUserById: async () => ({ preferences: { native_language_iso639_2: natives } }),
}));

import LocaleSwitcher from "./localeSwitcher";

const open = () => fireEvent.click(screen.getByRole("button", { name: /Language/ }));
const rows = () => screen.getAllByRole("option").map((o) => o.textContent);

describe("LocaleSwitcher", () => {
  beforeEach(() => refresh.mockClear());

  it("shows the ISO-2 code on the trigger", () => {
    render(<LocaleSwitcher currentUserId={null} />);
    expect(screen.getByRole("button", { name: /Language/ })).toHaveTextContent("en");
  });

  it("splits recommended and other languages into sections", async () => {
    natives = ["eng", "fra"];
    render(<LocaleSwitcher currentUserId="u1" />);
    await new Promise((r) => setTimeout(r, 20));
    open();
    expect(screen.getByText("Your languages · recommended")).toBeInTheDocument();
    expect(screen.getByText("Other languages")).toBeInTheDocument();
    expect(rows()).toEqual(["Englishen", "Françaisfr", "中文zh"]);
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getByRole("option", { name: /English/ })).toHaveAttribute("aria-selected", "true");
  });

  it("shows one plain section when no native language is supported", async () => {
    natives = ["spa"];
    render(<LocaleSwitcher currentUserId="u1" />);
    await new Promise((r) => setTimeout(r, 20));
    open();
    expect(screen.queryByText("Your languages · recommended")).toBeNull();
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(rows()).toEqual(["Englishen", "Françaisfr", "中文zh"]);
  });

  it("sets the cookie, closes and refreshes on selection", () => {
    render(<LocaleSwitcher currentUserId={null} />);
    open();
    fireEvent.click(screen.getByRole("option", { name: /中文/ }));
    expect(document.cookie).toContain("NEXT_LOCALE=zh");
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape and on outside click", () => {
    render(<LocaleSwitcher currentUserId={null} />);
    open();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    open();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
