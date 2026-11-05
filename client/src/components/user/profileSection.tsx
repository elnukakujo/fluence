"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import SectionCard from "./sectionCard";
import SaveButton from "./saveButton";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import { updateUser } from "@/api/user";
import { updateUserPreferences } from "@/api/userPreferences";
import { LANGUAGE_to_ISO639_2T } from "@/utils/language_iso639";
import type UserPreferences from "@/interface/systemData/UserPreferences";
import User from "@/interface/systemData/User";

function getInitials(user: User): string {
  const name = user.display_name || user.username || "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("") || "?";
}

export default function ProfileSection({ user, preferences = {} }: { user: User; preferences?: Partial<UserPreferences> }) {
  const t = useTranslations("settings.profile");
  const tp = useTranslations("settings.preferences");
  const [username, setUsername] = useState(user.username ?? "");
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [emailChanged, setEmailChanged] = useState(false);
  const [nativeLanguages, setNativeLanguages] = useState<string[]>(preferences.native_language_iso639_2 ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailChanged(value !== (user.email ?? ""));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (emailChanged && email !== emailConfirm) {
      setError(t("emailMismatch"));
      return;
    }

    setSaving(true);
    try {
      await updateUser(user.id, {
        username: username || undefined,
        display_name: displayName || undefined,
        email: email || undefined,
      });
      if (preferences.id) await updateUserPreferences(preferences.id, { native_language_iso639_2: nativeLanguages });
      setEmailChanged(false);
      setEmailConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title={t("title")}>
      {/* Avatar */}
      <div className="flex items-center gap-4 pb-3">
        <div
          className="flex items-center justify-center rounded-full select-none shrink-0"
          style={{
            width: "3.5rem",
            height: "3.5rem",
            background: "var(--color-accent-soft)",
            color: "var(--color-accent)",
            fontSize: "1.25rem",
            fontWeight: 600,
            fontFamily: "var(--font-serif)",
          }}
          aria-hidden="true"
        >
          {getInitials(user)}
        </div>
        <div>
          <p className="font-medium">{user.display_name || user.username}</p>
          {user.email && <p className="text-sm opacity-60">{user.email}</p>}
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--color-danger)" }} role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Username */}
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-70">{t("username")}</span>
          <input
            className="input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("usernamePlaceholder")}
            autoComplete="username"
            disabled={saving}
          />
        </label>

        {/* Display Name */}
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-70">{t("displayName")}</span>
          <input
            className="input"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("displayNamePlaceholder")}
            autoComplete="name"
            disabled={saving}
          />
        </label>

        {/* Email */}
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-70">{t("email")}</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            disabled={saving}
          />
        </label>

        {/* Email confirmation — only shown when email changed */}
        {emailChanged && (
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-70">{t("confirmNewEmail")}</span>
            <input
              className="input"
              type="email"
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              placeholder={t("confirmNewEmailPlaceholder")}
              autoComplete="email"
              disabled={saving}
            />
            <span className="text-xs opacity-50">
              {// TODO: replace with API call — backend email verification
            }</span>
          </label>
        )}

        <ClassicSelectMenu
          label={tp("nativeLanguages")}
          options={Object.values(LANGUAGE_to_ISO639_2T)}
          selectedOption={nativeLanguages}
          onChange={(v) => setNativeLanguages(v as string[])}
          multiple
        />

        <div>
          <SaveButton isLoading={saving} />
        </div>
      </form>
    </SectionCard>
  );
}
