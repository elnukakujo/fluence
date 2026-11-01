"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import SectionCard from "./sectionCard";
import ToggleRow from "./toggleRow";
import SaveButton from "./saveButton";
import { updateUserPreferences } from "@/api/userPreferences";
import { AlertTriangle } from "lucide-react";
import UserPreferences from "@/interface/systemData/UserPreferences";

const DEFAULTS: Record<string, boolean> = {
  feedback: true, learnable: true, example: true, word: true, tts: true,
};

export default function AiFeaturesSection({
  prefId,
  preferences,
  hasEndpoints,
}: {
  prefId: string;
  preferences: Partial<UserPreferences>;
  hasEndpoints: boolean;
}) {
  const t = useTranslations("settings.aiFeatures");
  const [toggles, setToggles] = useState({
    feedback: preferences.ai_feedback_enabled ?? true,
    learnable: preferences.ai_learnable_sentence_enabled ?? true,
    example: preferences.ai_example_sentence_enabled ?? true,
    word: preferences.ai_example_word_enabled ?? true,
    tts: preferences.ai_tts_enabled ?? true,
  });
  const [saving, setSaving] = useState(false);

  const FEATURES = [
    { key: "feedback", label: t("feedback"), desc: t("feedbackDesc") },
    { key: "learnable", label: t("learnable"), desc: t("learnableDesc") },
    { key: "example", label: t("example"), desc: t("exampleDesc") },
    { key: "word", label: t("word"), desc: t("wordDesc") },
    { key: "tts", label: t("tts"), desc: t("ttsDesc") },
  ] as const;

  const anyEnabled = Object.values(toggles).some(Boolean);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserPreferences(prefId, {
        ai_feedback_enabled: toggles.feedback,
        ai_learnable_sentence_enabled: toggles.learnable,
        ai_example_sentence_enabled: toggles.example,
        ai_example_word_enabled: toggles.word,
        ai_tts_enabled: toggles.tts,
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setToggles({
      feedback: true,
      learnable: true,
      example: true,
      word: true,
      tts: true,
    });
  };

  return (
    <SectionCard title={t("title")}>
      <p className="text-sm opacity-60">
        {t("description")}
      </p>

      {anyEnabled && !hasEndpoints && (
        <div
          className="flex items-center gap-2 text-sm rounded-lg p-3"
          style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
          role="alert"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{t("enabledNoEndpoint")}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-1">
        {FEATURES.map(({ key, label, desc }) => (
          <ToggleRow
            key={key}
            label={label}
            description={desc}
            checked={toggles[key]}
            onChange={(v) => setToggles((t) => ({ ...t, [key]: v }))}
            disabled={saving}
          />
        ))}

        <div className="flex items-center justify-between pt-3">
          <button
            type="button"
            className="text-xs opacity-50 hover:opacity-80 transition-opacity"
            onClick={resetToDefaults}
            disabled={saving}
          >
            {t("resetDefaults")}
          </button>
          <SaveButton isLoading={saving} onSuccessLabel={t("saveSuccessLabel")} />
        </div>
      </form>
    </SectionCard>
  );
}
