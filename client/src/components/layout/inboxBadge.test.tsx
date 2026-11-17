// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InboxBadge from "./inboxBadge";

let count = 3;
vi.mock("@/api/inbox", () => ({ getInbox: () => Promise.resolve({ count, groups: { exercise: [] } }) }));
vi.mock("next/link", () => ({ default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a> }));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string, v?: { count: number }) => (v ? `${k}:${v.count}` : k) }));

describe("InboxBadge", () => {
    afterEach(cleanup);

    it("links to the inbox with the count of drafts", async () => {
        count = 3;
        render(<InboxBadge />);
        const link = await screen.findByRole("link", { name: "inboxCount:3" });
        expect(link).toHaveAttribute("href", "/inbox");
    });

    it("renders nothing when the inbox is empty", async () => {
        count = 0;
        const { container } = render(<InboxBadge />);
        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
});
