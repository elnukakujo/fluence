"use client";
import { useEffect, useState } from "react";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import { getLevelLabel, languageProficiencySystems } from "@/utils/language_iso639";

export type SourceStepData = {
  source_title: string;
  source_type: string;
  source_description: string;
  level?: number;
};

type Props = {
  filename: string;
  onSourceChange: (data: SourceStepData) => void;
  languageCode: string;
  showLevel: boolean;
};

export default function SourceStep({ filename, onSourceChange, languageCode, showLevel }: Props) {
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("textbook");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState(1);

  // Prefill title from filename (without extension) on mount
  useEffect(() => {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    setTitle(nameWithoutExt);
  }, [filename]);

  // Notify parent of changes
  useEffect(() => {
    const data: SourceStepData = {
      source_title: title,
      source_type: sourceType,
      source_description: description,
    };
    if (showLevel) {
      data.level = level;
    }
    onSourceChange(data);
  }, [title, sourceType, description, level, showLevel, onSourceChange]);

  const system = languageProficiencySystems[languageCode];
  const levelOptions = system?.levels.map((_, idx) => ({
    label: getLevelLabel(system, idx),
    value: String(idx + 1),
  })) ?? [];

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-base font-medium">Where does this document come from?</legend>
      <AutoWidthInput
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Source title"
        required
      />

      <ClassicSelectMenu
        label="Source Type"
        options={["original", "textbook", "class", "online", "media", "social", "other", "ai"]}
        selectedOption={sourceType}
        onChange={(e) => setSourceType(e as string)}
        required
      />

      <AutoSizeTextArea
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add optional details"
      />

      {showLevel && levelOptions.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-70">Level</span>
          <select
            className="input"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
          >
            {levelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-xs opacity-70">Applied to every lesson created from this document.</span>
        </label>
      )}
    </fieldset>
  );
}
