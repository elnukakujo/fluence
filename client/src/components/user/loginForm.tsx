"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ring } from "ldrs/react";
import "ldrs/react/Ring.css";
import { login, updateUserPassword } from "@/api/user";

export default function LoginForm() {
    const router = useRouter();
    const t = useTranslations("loginForm");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [needsPassword, setNeedsPassword] = useState(false);
    const [userId, setUserId] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            const result = await login(email, password, remember);
            if (result.error) {
                setError(result.error);
                return;
            }
            if (result.needs_password) {
                setNeedsPassword(true);
                setUserId(result.user_id);
                setPassword("");
                return;
            }
            router.push('/');
            router.refresh();
        } catch {
            setError(t("loginFailed"));
        } finally {
            setSubmitting(false);
        }
    }

    async function handleSetPassword(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            await updateUserPassword(userId, password);
            await login(email, password, remember);
            router.push('/');
            router.refresh();
        } catch {
            setError(t("setPasswordFailed"));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-[75vh] items-center justify-center">
            <section className="card flex w-full max-w-sm flex-col gap-6 p-8">
                <header className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-3xl">Fluence</h1>
                    <p className="text-sm text-muted">{t("tagline")}</p>
                </header>

                <form
                    onSubmit={needsPassword ? handleSetPassword : handleLogin}
                    className="flex flex-col gap-4"
                >
                    {error && (
                        <div
                            role="alert"
                            className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                        >
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="login-email" className="text-sm font-medium">
                            {t("email")}
                        </label>
                        <input
                            id="login-email"
                            type="email"
                            className="input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t("emailPlaceholder")}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="login-password" className="text-sm font-medium">
                            {needsPassword ? t("setPassword") : t("password")}
                        </label>
                        <input
                            id="login-password"
                            type={showPassword ? "text" : "password"}
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={needsPassword ? t("choosePasswordPlaceholder") : t("passwordPlaceholder")}
                            autoComplete={needsPassword ? "new-password" : "current-password"}
                            required
                        />
                    </div>

                    {needsPassword && (
                        <p className="text-sm text-muted">
                            {t("noPasswordYet")}
                        </p>
                    )}

                    <div className="flex flex-col gap-3 pt-1">
                        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                            <span>{t("showPassword")}</span>
                            <input
                                type="checkbox"
                                className="toggle-switch"
                                checked={showPassword}
                                onChange={(e) => setShowPassword(e.target.checked)}
                            />
                        </label>
                        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                            <span>{t("rememberMe")}</span>
                            <input
                                type="checkbox"
                                className="toggle-switch"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                            />
                        </label>
                    </div>

                    <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                        {submitting ? (
                            <Ring size={18} color="#fff" />
                        ) : needsPassword ? (
                            t("setAndSignIn")
                        ) : (
                            t("signIn")
                        )}
                    </button>
                </form>

                <footer className="text-center text-sm text-muted">
                    {t("newHere")} <Link href="/user/new">{t("createAccount")}</Link>
                </footer>
            </section>
        </div>
    );
}
