// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/api/user", () => ({ createUser: vi.fn(), updateUser: vi.fn() }));
vi.mock("next-intl", async () => ({
  useLocale: () => "zh",
  useTranslations: (await import("@/test/intlMock")).translator,
}));

import UserForm from "./userForm";

const toStep2 = () => {
  fireEvent.change(screen.getByPlaceholderText("Enter username"), { target: { value: "a" } });
  fireEvent.change(screen.getByPlaceholderText("Enter email"), { target: { value: "a@b.co" } });
  fireEvent.change(screen.getByPlaceholderText("Enter password"), { target: { value: "x" } });
  fireEvent.click(screen.getByText("Next"));
};

describe("UserForm", () => {
  it("prefills native language from the UI locale on signup", () => {
    render(<UserForm />);
    toStep2();
    expect(screen.getByText("Chinese")).toBeInTheDocument();
  });

  it("keeps an existing user's natives", () => {
    render(<UserForm user={{ id: "1", username: "a", email: "a@b.co", preferences: { native_language_iso639_2: ["fra"] } } as never} />);
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("French")).toBeInTheDocument();
    expect(screen.queryByText("Chinese")).toBeNull();
  });
});
