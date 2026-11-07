"use client";

import { useState } from "react";
import { Ring } from "ldrs/react";
import "ldrs/react/Ring.css";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { nativeFromLocale, isLocale } from "@/i18n/locales";
import { createUser, updateUser } from "@/api/user";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import User from "@/interface/systemData/User";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import { LANGUAGE_to_ISO639_2T, ISO639_2T_to_LANGUAGE } from "@/utils/language_iso639";
import ProgressBar from "@/components/ui/progressBar";

const DAILY_GOAL_OPTIONS = ["5", "10", "15", "20", "30", "45", "60"];

export default function UserForm({ user, navDisabled = false, onSuccess }: {
    user?: User | Partial<User>;
    navDisabled?: boolean;
    onSuccess?: () => void;
}) {
    const isUpdate = Boolean(user?.id);
    const router = useRouter();
    const t = useTranslations("userForm");
    const locale = useLocale();

    const userData: Partial<User> = user ?? {
        id: "", username: "", last_review: new Date().toISOString(), created_at: new Date().toISOString()
    };

    const [step, setStep] = useState<number>(1);
    const [username, setUsername] = useState<string>(userData.username || "");
    const [displayName, setDisplayName] = useState<string>(userData.display_name || "");
    const [email, setEmail] = useState<string>(userData.email || "");
    const [password, setPassword] = useState<string>("");
    const [nativeLangs, setNativeLangs] = useState<string[]>(
        userData.preferences?.native_language_iso639_2 || (!isUpdate && isLocale(locale) ? nativeFromLocale(locale) : []),
    );
    const [dailyGoal, setDailyGoal] = useState<string>((userData.preferences?.daily_goal_minutes ?? 20).toString());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [stepError, setStepError] = useState("");
    const [createdPending, setCreatedPending] = useState(false);

    const handleNext = () => {
        if (!username.trim() || !email.trim() || (!isUpdate && !password)) {
            setStepError(t("fillRequired"));
            return;
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            setStepError(t("invalidEmail"));
            return;
        }
        setStepError("");
        setStep(2);
    };

    const handleBack = () => {
        setStepError("");
        setStep(1);
    };

    // `skip`: the preferences step is optional, so create the account with the defaults (20 min/day, natives from the UI language)
    const submit = async (skip = false) => {
        setIsSubmitting(true);
        const element: Partial<User> = {
            id: userData.id,
            username,
            display_name: displayName || undefined,
            email,
            ...(password ? { password } : {}),
            last_review: userData.last_review,
            created_at: userData.created_at,
            preferences: {
                user_id: userData.id!,
                native_language_iso639_2: skip ? (isLocale(locale) ? nativeFromLocale(locale) : []) : nativeLangs,
                daily_goal_minutes: skip ? 20 : parseInt(dailyGoal),
            },
        };
        try {
            if (isUpdate) {
                await updateUser(userData.id!, element);
            } else {
                const result = await createUser(element);
                if (result?.user?.approved === false) {
                    setCreatedPending(true);
                    return;
                }
            }
            if (!navDisabled) {
                router.push(`/`);
                router.refresh();
            }
        } catch (error) {
            console.error("Error creating/updating user:", error);
            alert(t(isUpdate ? "failedUpdate" : "failedCreate"));
        } finally {
            setIsSubmitting(false);
            if (onSuccess) onSuccess();
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); return submit(false); };

    if (createdPending) {
        return (
            <div className="card flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
                <h3 className="text-xl">{t("accountCreated")}</h3>
                <p className="text-sm text-muted">
                    {t("pendingApproval")}
                </p>
                <button type="button" className="btn btn-primary" onClick={() => router.push("/")}>
                    {t("goToSignIn")}
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 items-center">
            {/* ── Step indicator ─────────────────────────────────── */}
            <div className="flex w-full items-center gap-2">
                <span className="badge whitespace-nowrap">{t("step", { step })}</span>
                <ProgressBar thin className="flex-1" current={step} total={2} showLabel={false} showPercent={false} ariaLabel={t("step", { step })} />
            </div>

            {stepError && (
                <div role="alert" className="w-full rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {stepError}
                </div>
            )}

            {step === 1 ? (
                <div key="step-1" className="animate-fade-in flex w-full flex-col gap-4 items-center">
                    <h3 className="self-start">{t("yourAccount")}</h3>
                    <AutoWidthInput
                        label={t("username")}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t("usernamePlaceholder")}
                        required
                    />
                    <AutoWidthInput
                        label={t("displayName")}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t("displayNamePlaceholder")}
                    />
                    <AutoWidthInput
                        type="email"
                        label={t("email")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("emailPlaceholder")}
                        required={!isUpdate}
                    />
                    <AutoWidthInput
                        type={showPassword ? "text" : "password"}
                        label={isUpdate ? t("newPassword") : t("password")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isUpdate ? t("newPasswordPlaceholder") : t("passwordPlaceholder")}
                        required={!isUpdate}
                    />
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showPassword}
                            onChange={(e) => setShowPassword(e.target.checked)}
                        />
                        {t("showPassword")}
                    </label>
                    <button type="button" className="btn btn-primary w-full" onClick={handleNext}>
                        {t("next")}
                    </button>
                </div>
            ) : (
                <div key="step-2" className="animate-fade-in flex w-full flex-col gap-4 items-center">
                    <div className="flex w-full flex-wrap items-center gap-2">
                        <h3>{t("preferences")}</h3>
                        {!isUpdate && <span className="badge">{t("optional")}</span>}
                    </div>
                    {!isUpdate && <p className="self-start text-sm text-muted">{t("preferencesOptional")}</p>}
                    <article className="flex flex-col space-y-2 items-center">
                        <ClassicSelectMenu
                            label={t("nativeLanguages")}
                            options={Object.keys(LANGUAGE_to_ISO639_2T)}
                            selectedOption={nativeLangs.map((iso) => ISO639_2T_to_LANGUAGE[iso] ?? iso)}
                            onChange={(selected) => setNativeLangs((selected as string[]).map((name) => LANGUAGE_to_ISO639_2T[name] ?? name))}
                            multiple
                        />
                        <ClassicSelectMenu
                            label={t("dailyGoal")}
                            options={DAILY_GOAL_OPTIONS}
                            selectedOption={dailyGoal}
                            onChange={(selected) => setDailyGoal(selected as string)}
                        />
                    </article>
                    <div className="flex w-full gap-2">
                        <button type="button" className="btn btn-secondary flex-1" onClick={handleBack}>
                            {t("back")}
                        </button>
                        <button type="submit" className="btn btn-primary flex-1" disabled={isSubmitting}>
                            {isSubmitting ? <Ring size={16} color="#fff" /> : isUpdate ? t("saveChanges") : t("createAccount")}
                        </button>
                    </div>
                    {!isUpdate && (
                        <button type="button" className="btn btn-secondary w-full min-h-11" disabled={isSubmitting} onClick={() => submit(true)}>
                            {t("skipPreferences")}
                        </button>
                    )}
                </div>
            )}
        </form>
    );
}
