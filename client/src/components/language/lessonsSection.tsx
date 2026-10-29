"use client";

import { useEffect, useRef, useState } from "react";
import type Lesson from "@/interface/containers/Lesson";
import LessonOverviewCard from "@/components/lesson/lessonOverviewCard";
import { languageProficiencySystems } from "@/utils/language_iso639";

type FilterState = {
    tags: string[];
    sources: string[];
    levelCodes: string[]; // e.g. ["N5", "B1"]
};

function getName(item: unknown): string | null {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    return (typeof obj.name === "string" && obj.name)
        || (typeof obj.title === "string" && obj.title)
        || null;
}

function getLevelCode(level: number | null | undefined, levelCodes: string[]): string | null {
    if (level == null || level < 0 || level >= levelCodes.length) return null;
    return levelCodes[level];
}

function buildOptions(lessons: Lesson[], levelCodes: string[]) {
    const tags    = [...new Set(lessons.flatMap(l => (l.tags    ?? []).map(getName).filter(Boolean) as string[]))].sort();
    const sources = [...new Set(lessons.flatMap(l => (l.sources ?? []).map(getName).filter(Boolean) as string[]))].sort();
    const levels  = [...new Set(
        lessons
            .map(l => getLevelCode(l.level, levelCodes))
            .filter(Boolean) as string[]
    )];
    return { tags, sources, levels };
}

function toggleItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
}

function lessonMatchesFilter(lesson: Lesson, filters: FilterState, levelCodes: string[]): boolean {
    if (filters.tags.length) {
        const lessonTagNames = (lesson.tags ?? []).map(getName).filter(Boolean) as string[];
        if (!filters.tags.every(t => lessonTagNames.includes(t))) return false;
    }
    if (filters.sources.length) {
        const lessonSourceNames = (lesson.sources ?? []).map(getName).filter(Boolean) as string[];
        if (!filters.sources.every(s => lessonSourceNames.includes(s))) return false;
    }
    if (filters.levelCodes.length) {
        const code = getLevelCode(lesson.level, levelCodes);
        if (!code || !filters.levelCodes.includes(code)) return false;
    }
    return true;
}

export default function LessonsSection({
    lessons,
    language_code,
}: {
    lessons: Lesson[];
    language_code: string;
}) {
    const [query, setQuery]     = useState("");
    const [filters, setFilters] = useState<FilterState>({ tags: [], sources: [], levelCodes: [] });
    const [open, setOpen]       = useState(false);
    const dropdownRef           = useRef<HTMLDivElement>(null);

    const proficiencySystem = languageProficiencySystems[language_code];
    const levelCodes: string[] = proficiencySystem?.levels.map(l => l.code) ?? [];
    const testAbbr = proficiencySystem?.testAbbreviation ?? "Level";

    const options = buildOptions(lessons, levelCodes);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const activeFilterCount = filters.tags.length + filters.sources.length + filters.levelCodes.length;
    const clearAll = () => setFilters({ tags: [], sources: [], levelCodes: [] });

    const filtered = lessons.filter(lesson => {
        if (query && !lesson.title?.toLowerCase().includes(query.toLowerCase())) return false;
        return lessonMatchesFilter(lesson, filters, levelCodes);
    });

    const hasOptions = options.tags.length + options.sources.length + options.levels.length > 0;

    return (
        <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">

                {/* Search */}
                <div className="search-wrap" style={{ flex: 1 }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <circle cx="6.5" cy="6.5" r="5" />
                        <path d="M10.5 10.5l3 3" strokeLinecap="round" />
                    </svg>
                    <input
                        className="input"
                        type="search"
                        placeholder="Search lessons…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>

                {/* Filter trigger */}
                {hasOptions && (
                    <div className="filter-dropdown" ref={dropdownRef}>
                        <button
                            type="button"
                            className={`btn ${activeFilterCount > 0 ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => setOpen(o => !o)}
                            aria-expanded={open}
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                <path d="M1 3h12M3 7h8M5 11h4" strokeLinecap="round" />
                            </svg>
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="badge" style={{ marginLeft: "0.125rem" }}>
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {open && (
                            <div className="filter-panel">

                                {options.levels.length > 0 && (
                                    <div>
                                        <p className="filter-group-label">{testAbbr}</p>
                                        <div className="filter-chips">
                                            {options.levels.map(code => (
                                                <button
                                                    key={code}
                                                    type="button"
                                                    className={`filter-chip ${filters.levelCodes.includes(code) ? "active" : ""}`}
                                                    onClick={() => setFilters(f => ({ ...f, levelCodes: toggleItem(f.levelCodes, code) }))}
                                                >
                                                    {code}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {options.tags.length > 0 && (
                                    <div>
                                        <p className="filter-group-label">Tags</p>
                                        <div className="filter-chips">
                                            {options.tags.map(tag => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    className={`filter-chip ${filters.tags.includes(tag) ? "active" : ""}`}
                                                    onClick={() => setFilters(f => ({ ...f, tags: toggleItem(f.tags, tag) }))}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {options.sources.length > 0 && (
                                    <div>
                                        <p className="filter-group-label">Sources</p>
                                        <div className="filter-chips">
                                            {options.sources.map(source => (
                                                <button
                                                    key={source}
                                                    type="button"
                                                    className={`filter-chip ${filters.sources.includes(source) ? "active" : ""}`}
                                                    onClick={() => setFilters(f => ({ ...f, sources: toggleItem(f.sources, source) }))}
                                                >
                                                    {source}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeFilterCount > 0 && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ width: "100%", fontSize: "0.8125rem" }}
                                        onClick={clearAll}
                                    >
                                        Clear all filters
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Results */}
            {filtered.length > 0 ? (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 list-none">
                    {filtered.map(lesson => (
                        <li key={lesson.id}>
                            <LessonOverviewCard language_code={language_code} lesson={lesson} languageId={lesson.language_id} shared={lesson.shared} />
                        </li>
                    ))}
                </ul>
            ) : (
                <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>
                    No lessons match your search.
                </p>
            )}

            {activeFilterCount > 0 && (
                <p style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                    {filtered.length} of {lessons.length} lessons shown
                </p>
            )}
        </section>
    );
}