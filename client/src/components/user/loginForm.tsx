"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ring } from "ldrs/react";
import "ldrs/react/Ring.css";
import { login, updateUserPassword } from "@/api/user";

export default function LoginForm() {
    const router = useRouter();
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
            setError("Login failed. Please try again.");
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
            setError("Could not set password. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-[75vh] items-center justify-center">
            <section className="card flex w-full max-w-sm flex-col gap-6 p-8">
                <header className="flex flex-col items-center gap-1 text-center">
                    <h1 className="text-3xl">Fluence</h1>
                    <p className="text-sm text-muted">Become fluent. Sign in to continue.</p>
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
                            Email
                        </label>
                        <input
                            id="login-email"
                            type="email"
                            className="input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="login-password" className="text-sm font-medium">
                            {needsPassword ? "Set a password" : "Password"}
                        </label>
                        <input
                            id="login-password"
                            type={showPassword ? "text" : "password"}
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={needsPassword ? "Choose a password" : "Enter password"}
                            autoComplete={needsPassword ? "new-password" : "current-password"}
                            required
                        />
                    </div>

                    {needsPassword && (
                        <p className="text-sm text-muted">
                            This account has no password yet — set one to sign in.
                        </p>
                    )}

                    <div className="flex flex-col gap-3 pt-1">
                        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                            <span>Show password</span>
                            <input
                                type="checkbox"
                                className="toggle-switch"
                                checked={showPassword}
                                onChange={(e) => setShowPassword(e.target.checked)}
                            />
                        </label>
                        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                            <span>Remember me</span>
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
                            "Set password & sign in"
                        ) : (
                            "Sign in"
                        )}
                    </button>
                </form>

                <footer className="text-center text-sm text-muted">
                    New here? <Link href="/user/new">Create an account</Link>
                </footer>
            </section>
        </div>
    );
}
