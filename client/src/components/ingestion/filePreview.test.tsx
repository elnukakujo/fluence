// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FilePreview from "./filePreview";

afterEach(() => vi.unstubAllGlobals());

describe("FilePreview", () => {
  it("embeds a PDF at the first page of the range and shows an image as an image", () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined });
    const { rerender } = render(<FilePreview file={new File(["x"], "book.pdf", { type: "application/pdf" })} page={22} />);
    expect(screen.getByTitle("Preview of book.pdf")).toHaveAttribute("src", "blob:x#page=22");
    rerender(<FilePreview file={new File(["x"], "scan.png", { type: "image/png" })} />);
    expect(screen.getByAltText("Preview of scan.png")).toBeInTheDocument();
  });
});
