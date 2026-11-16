"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getLevelLabel, languageProficiencySystems } from "@/utils/language_iso639";
import Field from "@/components/ui/field";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";

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
      <Field label={t("sourceTitleLabel")}>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("sourceTitlePlaceholder")} required />
      </Field>

      <ClassicSelectMenu className="w-full" label={t("sourceTypeLabel")} options={[...SOURCE_TYPES]} optionLabel={(s) => t(`sourceType_${s}`)}
        selectedOption={sourceType} onChange={(v) => setSourceType(v as string)} />

      <Field label={t("sourceDescriptionLabel")}>
        <textarea className="input input-grow" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("sourceDescriptionPlaceholder")} />
      </Field>

      {showLevel && levelOptions.length > 0 && (
        <div className="flex flex-col gap-1">
          <ClassicSelectMenu className="w-full" label={t("levelLabel")} options={levelOptions.map((o) => String(o.value))}
            optionLabel={(v) => levelOptions.find((o) => String(o.value) === v)?.label}
            selectedOption={String(level)} onChange={(v) => setLevel(Number(v))} />
          <p className="text-sm text-muted">{t("levelApplied")}</p>
        </div>
      )}
    </fieldset>
  );
}
