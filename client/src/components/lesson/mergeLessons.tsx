"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type Lesson from "@/interface/containers/Lesson";
import { mergeLessons } from "@/api/lesson";
import { itemCount } from "@/lib/lessonOrder";

// Two lessons side by side (read-only) and the merged lesson's editable title, description and level.
// A survives (keeps its id, shares and collaborators); B's items move into it and B is deleted.
export default function MergeLessons({ languageId, a, b, levelOptions }: {
  languageId: string; a: Lesson; b: Lesson; levelOptions: string[];
}) {
  const t = useTranslations("lesson");
  const tUi = useTranslations("ui");
  const router = useRouter();
  const [title, setTitle] = useState(`${a.title} + ${b.title}`);
  const [description, setDescription] = useState(a.description || b.description || "");
  const [level, setLevel] = useState(Math.max(a.level ?? 0, b.level ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await mergeLessons({ first_id: a.id, second_id: b.id, title: title.trim(), description, level });
      router.push(`/languages/${languageId}/lesson/${a.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("mergeFailed"));
      setBusy(false);
    }
  };

  const panel = (side: "A" | "B", l: Lesson) => (
    <section aria-label={t("lessonSide", { side, title: l.title })} className="card flex flex-col gap-2">
      <details open={false} className="lg:[&>summary]:hidden" ref={(el) => { if (el && typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches) el.open = true; }}>
        <summary className="cursor-pointer font-serif text-lg">{side}: {l.title}</summary>
        <div className="mt-2 flex flex-col gap-2">
          <h3 className="hidden font-serif text-lg lg:block">{side}: {l.title}</h3>
          <p className="whitespace-pre-wrap text-sm">{l.description || <span className="text-muted">{t("noDescription")}</span>}</p>
          <p className="text-xs uppercase tracking-wide text-muted">{levelOptions[l.level] ?? l.level}</p>
          <p className="text-sm text-muted">{t("itemsCount", { n: itemCount(l) })}</p>
        </div>
      </details>
    </section>
  );

  const use = (field: "title" | "description" | "level", label: string, side: "A" | "B", l: Lesson) => (
    <button type="button" className="btn btn-secondary min-h-11 text-sm" aria-label={t(side === "A" ? "useFromA" : "useFromB", { field: label })}
      onClick={() => {
        if (field === "title") setTitle(l.title);
        else if (field === "description") setDescription(l.description ?? "");
        else setLevel(l.level ?? 0);
      }}>{t(side === "A" ? "useA" : "useB")}</button>
  );

  const labels = { title: t("lessonTitle").toLowerCase(), description: t("description").toLowerCase(), level: t("level").toLowerCase() };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <header>
        <h2>{t("mergeTitle")}</h2>
        <p className="text-sm text-muted">{t("mergeIntro")}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        {panel("A", a)}
        {panel("B", b)}
        <fieldset className="card flex flex-col gap-3">
          <legend className="font-serif text-lg">{t("mergedLesson")}</legend>
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t("lessonTitle")}</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <div className="flex gap-2">{use("title", labels.title, "A", a)}{use("title", labels.title, "B", b)}</div>
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t("description")}</span>
            <textarea className="input min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="flex gap-2">{use("description", labels.description, "A", a)}{use("description", labels.description, "B", b)}</div>
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t("level")}</span>
            <select className="input" value={String(level)} onChange={(e) => setLevel(Number(e.target.value))}>
              {levelOptions.map((code, i) => <option key={code} value={String(i)}>{code}</option>)}
            </select>
          </label>
          <div className="flex gap-2">{use("level", labels.level, "A", a)}{use("level", labels.level, "B", b)}</div>
        </fieldset>
      </div>
      <div className="card sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-40 flex flex-col gap-2 md:bottom-4">
        <p className="text-sm">{t("mergeSummary", { n: itemCount(b), other: b.title })}</p>
        {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => router.push(`/languages/${languageId}`)}>{tUi("cancel")}</button>
          <button type="submit" className="btn btn-primary min-h-11" disabled={busy || !title.trim()}>{busy ? t("merging") : t("mergeConfirm")}</button>
        </div>
      </div>
    </form>
  );
}
