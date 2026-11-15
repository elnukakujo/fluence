"use client";

import type { ReactNode } from "react";
import Spinner from "@/components/ui/spinner";

/** The submit button of an evaluated runner. While loading it shows the Spinner (which keeps an accessible name). */
export function CheckButton({ label, loading = false, disabled = false, type = "submit", onClick }: {
    label: string; loading?: boolean; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void;
}) {
    return (
        <button type={type} className="btn btn-primary" disabled={disabled || loading} onClick={onClick}>
            {loading ? <Spinner size={24} /> : label}
        </button>
    );
}

/** The result card of an evaluated runner: success or danger tone, announced to screen readers. The runner supplies the lines. */
export function FeedbackPanel({ correct, children }: { correct: boolean; children: ReactNode }) {
    return (
        <div role="status" className={`card mt-4 ${correct ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
            {children}
        </div>
    );
}
