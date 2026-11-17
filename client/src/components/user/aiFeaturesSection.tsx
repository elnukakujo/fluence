"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import SectionCard from "@/components/ui/sectionCard";
import ToggleRow from "./toggleRow";
import SaveButton from "./saveButton";
import { updateUserPreferences } from "@/api/userPreferences";
import UserPreferences from "@/interface/systemData/UserPreferences";
import DisabledReason from "@/components/ui/displays/disabledReason";
import { type Capability, type Feature, getCapabilities } from "@/api/capabilities";

export default function AiFeaturesSection({
  prefId,
  preferences,
}: {
  prefId: string;
  preferences: Partial<UserPreferences>;
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
  const [caps, setCaps] = useState<Record<Feature, Capability> | null>(null);
  useEffect(() => { getCapabilities().then(setCaps, () => setCaps(null)); }, []);

  const FEATURES = [
    { key: "feedback", label: t("feedback"), desc: t("feedbackDesc") },
    { key: "learnable", label: t("learnable"), desc: t("learnableDesc") },
    { key: "example", label: t("example"), desc: t("exampleDesc") },
    { key: "word", label: t("word"), desc: t("wordDesc") },
    { key: "tts", label: t("tts"), desc: t("ttsDesc") },
  ] as const;

  // One line per kind of endpoint, not per switch: the text features share one, text-to-speech has its own.
  const need = (features: Feature[], kind: "text" | "tts") => {
    const off = caps && features.map((f) => caps[f]).find((c) => !c.enabled && (c.needs === "endpoint" || c.needs === "test"));
    return off ? { enabled: false, needs: off.needs, reason: t(`${off.needs === "test" ? "needTest" : "needEndpoint"}_${kind}`) } : null;
  };
  const reasons = [need(["text_gen", "tutor_feedback"], "text"), need(["tts"], "tts")].filter((r): r is NonNullable<typeof r> => r !== null);

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
      {reasons.map((r) => <DisabledReason key={r.reason} capability={r} linkLabel={t("openEndpoints")} settingsHref="#ai" />)}

      <form onSubmit={handleSave} className="flex flex-col gap-1">
        {FEATURES.map(({ key, label, desc }) => (
          <div key={key}>
            <ToggleRow
              label={label}
              description={desc}
              checked={toggles[key]}
              onChange={(v) => setToggles((t) => ({ ...t, [key]: v }))}
              disabled={saving}
            />
          </div>
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
