"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type Tag from "@/interface/systemData/Tag";
import type Source from "@/interface/systemData/Source";
import { mergeTags } from "@/api/tag";
import { mergeSources } from "@/api/source";

type Item = Tag | Source;
const SOURCE_TYPES = ["original", "textbook", "class", "online", "media", "social", "other"];
const countElements = (a: Item, b: Item) =>
  new Set([a, b].flatMap((x) => Object.values(x.elements ?? {}).flat().map((e) => e.id))).size;
const text = (x: Item, f: string) => String((x as unknown as Record<string, unknown>)[f] ?? "");

// Two tags / sources and the merged result's editable fields. The one marked "keep" survives (keeps its id); the other is deleted.
export default function MergeLabels({ kind, a, b }: { kind: "tag" | "source"; a: Item; b: Item }) {
  const t = useTranslations("labels");
  const tUi = useTranslations("ui");
  const router = useRouter();
  const fields = kind === "tag" ? ["name", "color", "description"] : ["title", "date", "source_type", "description"];
  const [keep, setKeep] = useState<"a" | "b">("a");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f, text(a, f) || text(b, f)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const survivor = keep === "a" ? a : b;
  const loser = keep === "a" ? b : a;
  const main = kind === "tag" ? "name" : "title";
  const label = (x: Item) => text(x, main);
  const pick = (k: "a" | "b") => { setKeep(k); setValues(Object.fromEntries(fields.map((f) => [f, text(k === "a" ? a : b, f) || text(k === "a" ? b : a, f)]))); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const body = { keep_id: survivor.id, merge_id: loser.id, ...Object.fromEntries(fields.map((f) => [f, values[f] || undefined])) };
      if (kind === "tag") await mergeTags(body); else await mergeSources(body);
      router.push(kind === "tag" ? `/tags/${survivor.id}` : `/sources/${survivor.id}`);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : t("mergeFailed")); setBusy(false); }
  };

  const input = (f: string) => {
    const common = { id: `merge-${f}`, className: "input min-h-11", value: values[f] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement>) => setValues((v) => ({ ...v, [f]: e.target.value })) };
    if (f === "description") return <textarea {...common} className="input min-h-24" />;
    if (f === "source_type") return <select {...common}>{SOURCE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}</select>;
    if (f === "color") return <input {...common} type="color" value={values[f] || "#888888"} />;
    if (f === "date") return <input {...common} type="date" />;
    return <input {...common} required />;
  };
  const fieldLabel = (f: string) => t(f === "source_type" ? "sourceType" : f);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <header>
        <h2>{t("mergeTitle", { kind })}</h2>
        <p className="text-sm text-muted">{t("mergeIntro")}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        {([["a", a], ["b", b]] as const).map(([k, x]) => (
          <section key={k} className="card flex flex-col gap-2" aria-label={label(x)}>
            <h3 className="font-serif text-lg">{label(x)}</h3>
            {text(x, "description") && <p className="whitespace-pre-wrap text-sm">{text(x, "description")}</p>}
            <p className="text-sm text-muted">{t("elementsCount", { count: new Set(Object.values(x.elements ?? {}).flat().map((e) => e.id)).size })}</p>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="keep" className="h-5 w-5" checked={keep === k} onChange={() => pick(k)} />{t("keepThis")}
            </label>
          </section>
        ))}
        <fieldset className="card flex flex-col gap-3">
          <legend className="font-serif text-lg">{t("result")}</legend>
          {fields.map((f) => <label key={f} className="flex flex-col gap-1"><span className="text-sm">{fieldLabel(f)}</span>{input(f)}</label>)}
        </fieldset>
      </div>
      <div className="card sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-40 flex flex-col gap-2 md:bottom-4">
        <p className="text-sm">{t("mergeSummary", { count: countElements(a, b) })}</p>
        {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={() => router.back()}>{tUi("cancel")}</button>
          <button type="submit" className="btn btn-primary min-h-11" disabled={busy}>{busy ? t("merging") : t("merge")}</button>
        </div>
      </div>
    </form>
  );
}
