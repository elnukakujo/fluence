// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SourceStep from "./sourceStep";
import { languageProficiencySystems } from "@/utils/language_iso639";

describe("SourceStep", () => {
  it("prefills title from filename without extension", () => {
    render(<SourceStep filename="HSK2_vocabulary.pdf" onSourceChange={vi.fn()} languageCode="zho" showLevel={false} />);
    const titleInput = screen.getByDisplayValue("HSK2_vocabulary") as HTMLInputElement;
    expect(titleInput).toBeInTheDocument();
    expect(titleInput.value).toBe("HSK2_vocabulary");
  });

  it("defaults type select to 'textbook'", () => {
    const onChange = vi.fn();
    render(<SourceStep filename="book.pdf" onSourceChange={onChange} languageCode="zho" showLevel={false} />);
    // Check that the default value is textbook by verifying onChange was called with it
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      source_type: "textbook",
    }));
  });

  it("hides level select when showLevel is false", () => {
    render(<SourceStep filename="book.pdf" onSourceChange={vi.fn()} languageCode="zho" showLevel={false} />);
    expect(screen.queryByRole("combobox", { name: /level/i })).not.toBeInTheDocument();
  });

  it("shows level select with option labels when showLevel is true", () => {
    render(<SourceStep filename="book.pdf" onSourceChange={vi.fn()} languageCode="zho" showLevel={true} />);
    const levelSelect = screen.getByRole("combobox", { name: /level/i });
    expect(levelSelect).toBeInTheDocument();
    // Check that the system renders the level labels (HSK 1, HSK 2, etc for Chinese)
    const system = languageProficiencySystems["zho"];
    const option1 = screen.getByRole("option", { name: system.levels[0].code });
    expect(option1).toBeInTheDocument();
  });

  it("calls onSourceChange with the entered values", async () => {
    const onChange = vi.fn();
    render(<SourceStep filename="book.pdf" onSourceChange={onChange} languageCode="zho" showLevel={true} />);
    const user = userEvent.setup();

    const titleInput = screen.getByDisplayValue("book") as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, "My Book");

    const descriptionTextarea = screen.getByPlaceholderText(/optional/i) as HTMLTextAreaElement;
    await user.type(descriptionTextarea, "A test description");

    // Select level 5 from the level select
    const levelLabel = screen.getByText("Level");
    const levelContainer = levelLabel.closest("label")!;
    const levelSelect = within(levelContainer).getByRole("combobox") as HTMLSelectElement;
    await user.selectOptions(levelSelect, "5");

    // The onChange should be called with all the values
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      source_title: "My Book",
      source_type: "textbook",
      source_description: "A test description",
      level: 5,
    }));
  });

  it("allows optional description field to be empty", () => {
    const onChange = vi.fn();
    render(<SourceStep filename="book.pdf" onSourceChange={onChange} languageCode="zho" showLevel={false} />);

    // Empty description should still trigger onChange
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      source_description: "",
    }));
  });

  it("returns level as undefined when showLevel is false", () => {
    const onChange = vi.fn();
    render(<SourceStep filename="book.pdf" onSourceChange={onChange} languageCode="zho" showLevel={false} />);

    expect(onChange).toHaveBeenCalledWith(expect.not.objectContaining({
      level: expect.anything(),
    }));
  });
});
