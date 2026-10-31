// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PagePanel from "./pagePanel";

vi.mock("@/api/ingestion", () => ({ pageImageUrl: (jobId: string, page: number) => `/test-images/${jobId}/${page}.png` }));

describe("PagePanel", () => {
  it("renders the current page image and page counter", () => {
    const onPage = vi.fn();
    render(<PagePanel jobId="job1" page={2} pageCount={5} onPage={onPage} />);

    expect(screen.getByAltText("Page 2 of the document")).toHaveAttribute("src", "/test-images/job1/2.png");
    expect(screen.getByText("Page 2 / 5")).toBeInTheDocument();
  });

  it("disables prev button on first page", () => {
    const onPage = vi.fn();
    render(<PagePanel jobId="job1" page={1} pageCount={5} onPage={onPage} />);

    const prevBtn = screen.getByRole("button", { name: /prev/i });
    expect(prevBtn).toBeDisabled();
  });

  it("disables next button on last page", () => {
    const onPage = vi.fn();
    render(<PagePanel jobId="job1" page={5} pageCount={5} onPage={onPage} />);

    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toBeDisabled();
  });

  it("calls onPage with previous page number when prev is clicked", async () => {
    const onPage = vi.fn();
    render(<PagePanel jobId="job1" page={3} pageCount={5} onPage={onPage} />);

    const prevBtn = screen.getByRole("button", { name: /prev/i });
    await userEvent.click(prevBtn);

    expect(onPage).toHaveBeenCalledWith(2);
  });

  it("calls onPage with next page number when next is clicked", async () => {
    const onPage = vi.fn();
    render(<PagePanel jobId="job1" page={2} pageCount={5} onPage={onPage} />);

    const nextBtn = screen.getByRole("button", { name: /next/i });
    await userEvent.click(nextBtn);

    expect(onPage).toHaveBeenCalledWith(3);
  });

  it("enables prev and next buttons in the middle", () => {
    const onPage = vi.fn();
    render(<PagePanel jobId="job1" page={3} pageCount={5} onPage={onPage} />);

    const prevBtn = screen.getByRole("button", { name: /prev/i });
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });
});
