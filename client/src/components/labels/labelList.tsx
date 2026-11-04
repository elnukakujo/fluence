"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Tick from "@/components/elements/tick";

type Entry = { id: string; label: string; color?: string; description?: string };

// A tag / source list with a select-two-to-merge mode; outside that mode rows are plain links to the item.
export default function MergeableList({ kind, items, empty }: { kind: "tag" | "source"; items: Entry[]; empty: ReactNode }) {
  const t = useTranslations("labels");
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const base = kind === "tag" ? "/tags" : "/sources";
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const stop = () => { setSelecting(false); setPicked([]); };

  if (items.length === 0) return <>{empty}</>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`btn min-h-11 ${selecting ? "btn-primary" : "btn-secondary"}`} aria-pressed={selecting} onClick={() => (selecting ? stop() : setSelecting(true))}>
          {selecting ? t("done") : t("selectToMerge")}
        </button>
        {selecting && <>
          <span className="text-sm" aria-live="polite">{t("selectedCount", { count: picked.length })}</span>
          <button type="button" className="btn btn-primary min-h-11" disabled={picked.length !== 2} title={picked.length === 2 ? undefined : t("mergeNeedsTwo")}
            onClick={() => router.push(`${base}/merge?a=${picked[0]}&b=${picked[1]}`)}>{t("mergeSelected")}</button>
        </>}
      </div>
      <ul className="card list-none flex flex-col gap-1">
        {items.map((it) => (
          <li key={it.id}>
            {selecting ? (
              <label className="pick-row" data-selected={picked.includes(it.id)}>
                <input type="checkbox" className="tick-input" checked={picked.includes(it.id)} onChange={() => toggle(it.id)} /><Tick />
                <span className="text-sm">{it.label}</span>
              </label>
            ) : (
              <Link href={`${base}/${it.id}`} className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent-soft">
                {kind === "tag" ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: it.color }} /> : <span className="badge shrink-0" />}
                <span className="text-sm">{it.label}</span>
                {it.description && <span className="ml-auto truncate text-xs text-muted">{it.description}</span>}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
