// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import PageRanges from "./pageRanges";
import type { RangeDraft } from "@/lib/ingestion/ranges";

function Harness({ initial, errorRow, error }: { initial: RangeDraft[]; errorRow?: number; error?: string }) {
  const [rows, setRows] = useState(initial);
  return <PageRanges rows={rows} onChange={setRows} last={50} errorRow={errorRow} error={error} />;
}

describe("PageRanges", () => {
  it("labels each row's inputs and summarises ranges and pages", () => {
    render(<Harness initial={[{ start: "1", end: "3" }, { start: "10", end: "11" }]} />);
    expect(screen.getAllByLabelText(/From page/)).toHaveLength(2);
    expect(screen.getAllByLabelText(/To page/)).toHaveLength(2);
    expect(screen.getByText("2 ranges, 5 pages")).toBeInTheDocument();
  });
  it("Add range appends a row starting after the last end", async () => {
    render(<Harness initial={[{ start: "1", end: "3" }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Add range" }));
    const from = screen.getAllByLabelText(/From page/) as HTMLInputElement[];
    expect(from).toHaveLength(2);
    expect(from[1].value).toBe("4");
  });
  it("removes a row by an accessible name and never removes the last one", async () => {
    render(<Harness initial={[{ start: "1", end: "3" }, { start: "5", end: "6" }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove range 2" }));
    expect(screen.getAllByLabelText(/From page/)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Remove range 1" })).toBeDisabled();
  });
  it("shows the error under the offending row", () => {
    render(<Harness initial={[{ start: "1", end: "3" }, { start: "2", end: "4" }]} errorRow={1} error="Pages 1-3 and 2-4 overlap" />);
    expect(screen.getByRole("alert")).toHaveTextContent("overlap");
  });
});
