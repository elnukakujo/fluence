"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import SectionCard from "./sectionCard";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import SaveButton from "./saveButton";
import { updateUserPreferences } from "@/api/userPreferences";
import { LANGUAGE_to_ISO639_2T } from "@/utils/language_iso639";
import UserPreferences from "@/interface/systemData/UserPreferences";

export default function PreferencesSection({ preferences }: { preferences: Partial<UserPreferences> }) {
  const t = useTranslations("settings.preferences");
  const [nativeLanguages, setNativeLanguages] = useState<string[]>(
    preferences.native_language_iso639_2 ?? []
  );
  const [learningGoals, setLearningGoals] = useState(preferences.learning_goals ?? "");
  const [dailyGoal, setDailyGoal] = useState(preferences.daily_goal_minutes ?? 20);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserPreferences(preferences.id!, {
        native_language_iso639_2: nativeLanguages,
        learning_goals: learningGoals,
        daily_goal_minutes: dailyGoal,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title={t("title")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Target Language */}
        <ClassicSelectMenu
          label={t("nativeLanguages")}
          options={Object.values(LANGUAGE_to_ISO639_2T)}
          selectedOption={nativeLanguages}
          onChange={(v) => setNativeLanguages(v as string[])}
          multiple
        />

        {/* Daily Goal */}
        <div className="flex flex-col gap-1">
          <span className="text-sm opacity-70">{t("dailyGoal")}</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              className="flex-1 accent-[var(--color-primary)]"
              min={5}
              max={60}
              step={5}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
              disabled={saving}
              aria-label={t("dailyGoalAria")}
            />
            <input
              type="number"
              className="input w-16 text-center"
              min={5}
              max={60}
              step={5}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
              disabled={saving}
              aria-label={t("dailyGoalValueAria")}
            />
            <span className="text-sm opacity-60">{t("dailyGoalUnit")}</span>
          </div>
        </div>

        {/* Learning Goals */}
        <AutoSizeTextArea
          label={t("learningGoals")}
          value={learningGoals}
          onChange={(e) => setLearningGoals(e.target.value)}
          placeholder={t("learningGoalsPlaceholder")}
        />

        <div>
          <SaveButton isLoading={saving} />
        </div>
      </form>
    </SectionCard>
  );
}
