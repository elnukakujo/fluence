"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";

/** Filter popover for the exercise list. State lives in the URL (`?type=a,b&status=ready|notready`), so the server page filters. */
export default function ExerciseFilter({ types }: { types: string[] }) {
    const t = useTranslations("exercises");
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selectedTypes = (params.get("type") ?? "").split(",").filter(Boolean);
    const status = params.get("status") ?? "";
    const count = selectedTypes.length + (status ? 1 : 0);

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

    return (
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
                        <p className="filter-group-label">{t("filterType")}</p>
                        <div className="filter-chips">
                            {types.map((type) => (
                                <button key={type} type="button" aria-pressed={selectedTypes.includes(type)}
                                    className={`filter-chip ${selectedTypes.includes(type) ? "active" : ""}`} onClick={() => toggleType(type)}>
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                    {count > 0 && <button type="button" className="btn btn-secondary" onClick={() => router.replace(pathname)}>{t("filterClear")}</button>}
                </div>
            )}
        </div>
    );
}
