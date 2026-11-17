// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DisabledReason from "@/components/ui/displays/disabledReason";
import { useCapability } from "./useCapability";

let next: () => Promise<unknown> = () => Promise.resolve({});
const getCapabilities = { mockResolvedValue: (v: unknown) => { next = () => Promise.resolve(v); }, failWith: (e: Error) => { next = () => Promise.reject(e); }, mockReset: () => { next = () => Promise.resolve({}); } };
vi.mock("@/api/capabilities", () => ({ getCapabilities: () => next() }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

function Probe() {
    const cap = useCapability("tts");
    return <div data-testid="p">{cap.loading ? "loading" : cap.enabled ? "on" : `off:${cap.reason}`}<DisabledReason capability={cap} linkLabel="Open settings" /></div>;
}

describe("useCapability", () => {
    beforeEach(() => getCapabilities.mockReset());
    afterEach(cleanup);

    it("returns the reason and the control stays visible, with a link out", async () => {
        getCapabilities.mockResolvedValue({ tts: { enabled: false, reason: "Add a TTS endpoint", needs: "endpoint" } });
        render(<Probe />);
        await waitFor(() => expect(screen.getByTestId("p")).toHaveTextContent("off:Add a TTS endpoint"));
        expect(screen.getByRole("link", { name: "Open settings" })).toHaveAttribute("href", "/user");
    });

    it("is on when the server says so, and shows no reason", async () => {
        getCapabilities.mockResolvedValue({ tts: { enabled: true, reason: null, needs: null } });
        render(<Probe />);
        await waitFor(() => expect(screen.getByTestId("p")).toHaveTextContent("on"));
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("reads as off, not as an error, when the check fails", async () => {
        getCapabilities.failWith(new Error("down"));
        render(<Probe />);
        await waitFor(() => expect(screen.getByTestId("p")).toHaveTextContent("off:null"));
    });
});
