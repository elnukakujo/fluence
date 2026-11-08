"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { categoryLabel, GROUP_BYS } from "@/utils/groupByCategory";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import type { ExamCategory } from "@/utils/language_iso639";

/** Filter popover for the exercise list. State lives in the URL (`?type=a,b&status=ready|notready`), so the server page filters. */
export default function ExerciseFilter({ types, categories = [] }: { types: string[]; categories?: ExamCategory[] }) {
    const t = useTranslations("exercises");
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selectedTypes = (params.get("type") ?? "").split(",").filter(Boolean);
    const status = params.get("status") ?? "";
    const category = params.get("category") ?? "";
    const origin = params.get("origin") ?? "";
    const count = selectedTypes.length + (status ? 1 : 0) + (category ? 1 : 0) + (origin ? 1 : 0);

    useEffect(() => {
        const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const set = (key: string, value: string) => {
        const next = new URLSearchParams(params.toString());
        if (value) next.set(key, value); else next.delete(key);
        router.replace(next.size ? `${pathname}?${next}` : pathname);
    };
    const toggleType = (type: string) =>
        set("type", (selectedTypes.includes(type) ? selectedTypes.filter((x) => x !== type) : [...selectedTypes, type]).join(","));

    const groupBy = params.get("group") ?? "category";
    const groupNames: Record<string, string> = { category: t("filterCategory"), source: t("filterSource"), tag: t("filterTag"), status: t("filterStatus"), type: t("filterType") };

    return (<>
        <label className="inline-flex items-center gap-2 text-sm">
            <span className="text-muted">{t("groupBy")}</span>
            <select className="min-h-11 rounded-lg border border-border bg-background px-2" value={groupBy} onChange={(e) => set("group", e.target.value === "category" ? "" : e.target.value)}>
                {GROUP_BYS.map((g) => <option key={g} value={g}>{groupNames[g]}</option>)}
            </select>
        </label>
        <div className="filter-dropdown" ref={ref}>
            <button type="button" className={`btn ${count ? "btn-primary" : "btn-secondary"} inline-flex items-center gap-2`}
                aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <SlidersHorizontal size={14} aria-hidden />
                {t("filters")}
                {count > 0 && <span className="badge">{count}</span>}
            </button>
            {open && (
                <div className="filter-panel">
                    <div>
                        <p className="filter-group-label">{t("filterStatus")}</p>
                        <div className="filter-chips">
                            {(["ready", "notready"] as const).map((s) => (
                                <button key={s} type="button" aria-pressed={status === s} className={`filter-chip ${status === s ? "active" : ""}`}
                                    onClick={() => set("status", status === s ? "" : s)}>
                                    {t(s === "ready" ? "statusReady" : "statusNotReady")}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="filter-group-label">{t("filterOrigin")}</p>
                        <div className="filter-chips">
                            <button type="button" aria-pressed={origin === "ai"} className={`filter-chip ${origin === "ai" ? "active" : ""}`}
                                onClick={() => set("origin", origin === "ai" ? "" : "ai")}>{t("originAi")}</button>
                        </div>
                    </div>
                    {categories.length > 0 && (
                        <div>
                            <p className="filter-group-label">{t("filterCategory")}</p>
                            <div className="filter-chips">
                                {categories.map((c) => (
                                    <button key={c.slug} type="button" aria-pressed={category === c.slug} className={`filter-chip ${category === c.slug ? "active" : ""}`}
                                        onClick={() => set("category", category === c.slug ? "" : c.slug)}>
                                        {categoryLabel(t, c.slug)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <p className="filter-group-label">{t("filterType")}</p>
                        <div className="filter-chips">
                            {types.map((type) => (
                                <button key={type} type="button" aria-pressed={selectedTypes.includes(type)}
                                    className={`filter-chip ${selectedTypes.includes(type) ? "active" : ""}`} onClick={() => toggleType(type)}>
                                    {EXERCISE_TYPE_KEY[type] ? t(EXERCISE_TYPE_KEY[type]) : type}
                                </button>
                            ))}
                        </div>
                    </div>
                    {count > 0 && <button type="button" className="btn btn-secondary" onClick={() => router.replace(pathname)}>{t("filterClear")}</button>}
                </div>
            )}
        </div>
    </>);
}
