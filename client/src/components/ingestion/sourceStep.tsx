"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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

const SOURCE_TYPES = ["original", "textbook", "class", "online", "media", "social", "other", "ai"];

export default function SourceStep({ filename, onSourceChange, languageCode, showLevel }: Props) {
  const t = useTranslations("ingestion");
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("textbook");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState(0);   // 0-based index into the proficiency levels, as lessons store it

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
    value: String(idx),
  })) ?? [];

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-base font-semibold">{t("sourceStepHeading")}</legend>
      <label className="flex flex-col gap-1">
        <span className="field-label">{t("sourceTitleLabel")}</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("sourceTitlePlaceholder")} required />
      </label>

      <label className="flex flex-col gap-1">
        <span className="field-label">{t("sourceTypeLabel")}</span>
        <select className="input" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
          {SOURCE_TYPES.map((s) => <option key={s} value={s}>{t(`sourceType_${s}`)}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="field-label">{t("sourceDescriptionLabel")}</span>
        <textarea className="input input-grow" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("sourceDescriptionPlaceholder")} />
      </label>

      {showLevel && levelOptions.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="field-label">{t("levelLabel")}</span>
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
          <span className="text-xs opacity-70">{t("levelApplied")}</span>
        </label>
      )}
    </fieldset>
  );
}
