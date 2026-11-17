"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { acceptDrafts, getInbox, rejectDrafts } from "@/api/inbox";
import { INBOX_CHANGED } from "@/components/layout/inboxBadge";
import ExerciseBody from "@/components/ingestion/exerciseBody";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import type Exercise from "@/interface/features/Exercise";
import type { Row } from "@/lib/ingestion/review";
import EmptyState from "@/components/ui/emptyState";
import InlineError from "@/components/ui/inlineError";

const toRow = (e: Exercise): Row => ({
    candidate: { id: e.id!, quote: "", page: 0, chunk_id: "", status: "verified", flags: [], min_conf: null, kind: "exercise" },
    selected: false, on_conflict: null, exercise_type: e.exercise_type, question: e.question, answer: e.answer,
    text_support: e.text_support ?? null, content: (e.content ?? null) as Row["content"],
});

/** The inbox: AI-made material waiting to be accepted into study. Accept or reject one by one, or all at once. */
export default function InboxPage() {
    const t = useTranslations("inbox");
    const tx = useTranslations("exercises");
    const [drafts, setDrafts] = useState<Exercise[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => { getInbox().then((i) => setDrafts(i.groups.exercise), () => setError(t("loadFailed"))); }, [t]);

    const act = async (ids: string[], fn: (ids: string[]) => Promise<unknown>) => {
        setBusy(true);
        setError("");
        try {
            await fn(ids);
            setDrafts((cur) => (cur ?? []).filter((d) => !ids.includes(d.id!)));
            window.dispatchEvent(new Event(INBOX_CHANGED));
        } catch { setError(t("actionFailed")); } finally { setBusy(false); }
    };

    return (
        <div className="flex flex-col gap-4">
            <h1>{t("title")}</h1>
            <p className="text-sm text-muted">{t("intro")}</p>
            {error && <InlineError>{error}</InlineError>}
            {drafts && drafts.length === 0 && <EmptyState>{t("empty")}</EmptyState>}
            {drafts && drafts.length > 0 && (
                <>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn btn-primary min-h-11" disabled={busy} onClick={() => act(drafts.map((d) => d.id!), acceptDrafts)}>{t("acceptAll")}</button>
                        <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => act(drafts.map((d) => d.id!), rejectDrafts)}>{t("rejectAll")}</button>
                    </div>
                    <ul className="flex list-none flex-col gap-3 p-0">
                        {drafts.map((d) => (
                            <li key={d.id} className="card flex flex-col gap-2">
                                <p className="flex flex-wrap items-center gap-2">
                                    <span className="badge">{EXERCISE_TYPE_KEY[d.exercise_type ?? ""] ? tx(EXERCISE_TYPE_KEY[d.exercise_type ?? ""]) : d.exercise_type}</span>
                                    <span className="badge">{t("machineMade")}</span>
                                    {d.review_reason && <span className="badge badge-warn">{d.review_reason}</span>}
                                </p>
                                <ExerciseBody row={toRow(d)} />
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" className="btn btn-primary min-h-11" disabled={busy} onClick={() => act([d.id!], acceptDrafts)}>{t("accept")}</button>
                                    <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => act([d.id!], rejectDrafts)}>{t("reject")}</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
