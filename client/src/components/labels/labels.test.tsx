// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Tag from "@/interface/systemData/Tag";

const api = vi.hoisted(() => ({ mergeTags: vi.fn(), getAllUserTags: vi.fn(), bulkDeleteTags: vi.fn(), reorderTags: vi.fn() }));
const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }));
vi.mock("@/api/tag", () => api);
vi.mock("@/api/lesson", () => ({ getAllLessons: vi.fn() }));
vi.mock("@/api/source", () => ({ mergeSources: vi.fn(), bulkDeleteSources: vi.fn(), reorderSources: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

import LabelList from "./labelList";
import MergeLabels from "./mergeLabels";

const tag = (id: string, name: string, els: string[] = [], extra = {}) =>
  ({ id, user_id: "u", name, color: "#ff0000", elements: { voc: els.map((e) => ({ id: e, label: e })) }, ...extra }) as unknown as Tag;

beforeEach(() => { vi.clearAllMocks(); api.mergeTags.mockResolvedValue({}); });

describe("LabelList", () => {
  const items = [{ id: "tag_1", label: "one" }, { id: "tag_2", label: "two" }, { id: "tag_3", label: "three" }];
  it("keeps Merge in the bar, enabled only with exactly two selected, and opens the merge page", async () => {
    render(<LabelList kind="tag" items={items} empty={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select one" }));
    expect(screen.getByRole("button", { name: "Merge" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Tags" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select three" }));
    await userEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(nav.push).toHaveBeenCalledWith("/tags/merge?a=tag_1&b=tag_3");
  });

  it("reorders the tags with the arrows and saves the order", async () => {
    api.reorderTags.mockResolvedValue(undefined);
    render(<LabelList kind="tag" items={items} empty={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("button", { name: "Move one down" }));
    expect(api.reorderTags).toHaveBeenCalledWith(["tag_2", "tag_1", "tag_3"]);
  });

  it("deletes the selected tags after confirming", async () => {
    api.bulkDeleteTags.mockResolvedValue({ deleted: 3 });
    render(<LabelList kind="tag" items={items} empty={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Select all/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(api.bulkDeleteTags).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete 3" }));
    expect(api.bulkDeleteTags).toHaveBeenCalledWith(["tag_1", "tag_2", "tag_3"]);
  });
});

describe("MergeLabels", () => {
  it("counts the union of elements and sends the survivor, the loser and the edited result", async () => {
    render(<MergeLabels kind="tag" a={tag("tag_1", "one", ["voc_1", "voc_2"])} b={tag("tag_2", "two", ["voc_2", "voc_3"])} />);
    expect(screen.getByText("3 elements will carry the result.")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "both");
    await userEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(api.mergeTags).toHaveBeenCalledWith(expect.objectContaining({ keep_id: "tag_1", merge_id: "tag_2", name: "both" }));
    expect(nav.push).toHaveBeenCalledWith("/tags/tag_1");
  });
  it("keeping the other one swaps the survivor and prefills its fields; errors show inline", async () => {
    render(<MergeLabels kind="tag" a={tag("tag_1", "one")} b={tag("tag_2", "two")} />);
    await userEvent.click(screen.getAllByRole("radio")[1]);
    expect(screen.getByLabelText("Name")).toHaveValue("two");
    api.mergeTags.mockRejectedValueOnce(new Error("That name is already used by another tag"));
    await userEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already used");
    expect(api.mergeTags).toHaveBeenCalledWith(expect.objectContaining({ keep_id: "tag_2", merge_id: "tag_1" }));
  });
});
