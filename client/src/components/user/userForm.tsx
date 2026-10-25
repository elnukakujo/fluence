"use client";

import { useState } from "react";
import { Ring } from "ldrs/react";
import "ldrs/react/Ring.css";
import { useRouter } from "next/navigation";
import { createUser, updateUser } from "@/api/user";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import User from "@/interface/systemData/User";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";
import { LANGUAGE_to_ISO639_2T } from "@/utils/language_iso639";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";

const EXERCISE_TYPES = [
    "essay", "answering", "translate", "organize", "conversation",
    "type_in_the_blank", "select_in_the_blank", "matching", "true_false", "speaking",
];
const DAILY_GOAL_OPTIONS = ["5", "10", "15", "20", "30", "45", "60"];

export default function UserForm({ user, navDisabled = false, onSuccess }: {
    user?: User | Partial<User>;
    navDisabled?: boolean;
    onSuccess?: () => void;
}) {
    const isUpdate = Boolean(user?.id);
    const router = useRouter();

    const userData: Partial<User> = user ?? {
        id: "", username: "", last_review: new Date().toISOString(), created_at: new Date().toISOString()
    };

    const [step, setStep] = useState<number>(1);
    const [username, setUsername] = useState<string>(userData.username || "");
    const [displayName, setDisplayName] = useState<string>(userData.display_name || "");
    const [email, setEmail] = useState<string>(userData.email || "");
    const [password, setPassword] = useState<string>("");
    const [nativeLangs, setNativeLangs] = useState<string[]>(userData.preferences?.native_language_iso639_2 || []);
    const [learningGoals, setLearningGoals] = useState<string>(userData.preferences?.learning_goals || "");
    const [exerciseTypes, setExerciseTypes] = useState<string[]>(userData.preferences?.preferred_exercise_types || []);
    const [dailyGoal, setDailyGoal] = useState<string>((userData.preferences?.daily_goal_minutes ?? 20).toString());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [stepError, setStepError] = useState("");

    const handleNext = () => {
        if (!username.trim() || !email.trim() || (!isUpdate && !password)) {
            setStepError("Please fill in your username, email, and password.");
            return;
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            setStepError("Please enter a valid email address.");
            return;
        }
        setStepError("");
        setStep(2);
    };

    const handleBack = () => {
        setStepError("");
        setStep(1);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
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
                native_language_iso639_2: nativeLangs,
                learning_goals: learningGoals,
                preferred_exercise_types: exerciseTypes,
                daily_goal_minutes: parseInt(dailyGoal),
            },
        };
        try {
            if (isUpdate) {
                await updateUser(userData.id!, element);
            } else {
                await createUser(element);
            }
            if (!navDisabled) {
                router.push(`/`);
                router.refresh();
            }
        } catch (error) {
            console.error("Error creating/updating user:", error);
            alert(`Failed to ${isUpdate ? "update" : "create"} user.`);
        } finally {
            setIsSubmitting(false);
            if (onSuccess) onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 items-center">
            {/* ── Step indicator ─────────────────────────────────── */}
            <div className="flex w-full items-center gap-2">
                <span className="badge whitespace-nowrap">Step {step} of 2</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                    <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: step === 1 ? "50%" : "100%" }}
                    />
                </div>
            </div>

            {stepError && (
                <div role="alert" className="w-full rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {stepError}
                </div>
            )}

            {step === 1 ? (
                <div key="step-1" className="animate-fade-in flex w-full flex-col gap-4 items-center">
                    <h3 className="self-start">Your account</h3>
                    <AutoWidthInput
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter username"
                        required
                    />
                    <AutoWidthInput
                        label="Display Name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Shown instead of username, optional"
                    />
                    <AutoWidthInput
                        type="email"
                        label="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter email"
                        required={!isUpdate}
                    />
                    <AutoWidthInput
                        type={showPassword ? "text" : "password"}
                        label={isUpdate ? "New Password (leave blank to keep current)" : "Password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isUpdate ? "Leave blank to keep current password" : "Enter password"}
                        required={!isUpdate}
                    />
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showPassword}
                            onChange={(e) => setShowPassword(e.target.checked)}
                        />
                        Show password
                    </label>
                    <button type="button" className="btn btn-primary w-full" onClick={handleNext}>
                        Next
                    </button>
                </div>
            ) : (
                <div key="step-2" className="animate-fade-in flex w-full flex-col gap-4 items-center">
                    <h3 className="self-start">Your preferences</h3>
                    <article className="flex flex-col space-y-2 items-center">
                        <ClassicSelectMenu
                            label="Native Languages"
                            options={Object.values(LANGUAGE_to_ISO639_2T)}
                            selectedOption={nativeLangs}
                            onChange={(selected) => setNativeLangs(selected as string[])}
                            multiple
                        />
                        <AutoSizeTextArea
                            label="Learning Goals"
                            value={learningGoals}
                            onChange={(e) => setLearningGoals(e.target.value)}
                            placeholder="Enter learning goals"
                        />
                        <ClassicSelectMenu
                            label="Preferred Exercise Types"
                            options={EXERCISE_TYPES}
                            selectedOption={exerciseTypes}
                            onChange={(selected) => setExerciseTypes(selected as string[])}
                            multiple
                        />
                        <ClassicSelectMenu
                            label="Daily Goal (minutes)"
                            options={DAILY_GOAL_OPTIONS}
                            selectedOption={dailyGoal}
                            onChange={(selected) => setDailyGoal(selected as string)}
                        />
                    </article>
                    <div className="flex w-full gap-2">
                        <button type="button" className="btn btn-secondary flex-1" onClick={handleBack}>
                            Back
                        </button>
                        <button type="submit" className="btn btn-primary flex-1" disabled={isSubmitting}>
                            {isSubmitting ? <Ring size={16} color="#fff" /> : isUpdate ? "Save changes" : "Create account"}
                        </button>
                    </div>
                </div>
            )}
        </form>
    );
}
