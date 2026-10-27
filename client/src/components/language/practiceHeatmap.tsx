"use client";

import { useState } from "react";
import type DailyStats from "@/interface/dataCollection/DailyStats";

function toDateKey(iso: string): string {
    return iso.slice(0, 10);
}

// Builds the same "YYYY-MM-DD" key from a Date's LOCAL calendar fields — never
// via toISOString()/Date("YYYY-MM-DD"), both of which round-trip through UTC
// and can shift the date by one day depending on the browser's UTC offset.
function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateKey(key: string): Date {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function intensityLevel(itemsReviewed: number): 0 | 1 | 2 | 3 | 4 {
    if (itemsReviewed <= 0) return 0;
    if (itemsReviewed < 5) return 1;
    if (itemsReviewed < 15) return 2;
    if (itemsReviewed < 30) return 3;
    return 4;
}

function formatDuration(ms: number): string {
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// A user can have one DailyStats row per language per day — sum them into one bucket per date.
type DayTotals = { items_reviewed: number; items_correct: number; time_studied_ms: number };

export default function PracticeHeatmap({ history }: { history: DailyStats[] }) {
    // Rendered via position: fixed (not a CSS ::after tooltip) because the
    // heatmap's ancestor scroll container sets overflow-x: auto, which per
    // the CSS overflow spec forces overflow-y to also compute as auto (an
    // axis can't stay "visible" while the other isn't) — any absolutely
    // positioned tooltip inside it gets clipped vertically. position: fixed
    // escapes that ancestor clipping entirely.
    const [hovered, setHovered] = useState<{ x: number; y: number; text: string } | null>(null);

    const byDate = new Map<string, DayTotals>();
    for (const entry of history) {
        const key = toDateKey(entry.created_at);
        const totals = byDate.get(key) ?? { items_reviewed: 0, items_correct: 0, time_studied_ms: 0 };
        totals.items_reviewed += entry.items_reviewed;
        totals.items_correct += entry.items_correct;
        totals.time_studied_ms += entry.time_studied_ms;
        byDate.set(key, totals);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Always show at least 12 weeks so a new account doesn't render a 3-square stub
    const minStart = new Date(today);
    minStart.setDate(minStart.getDate() - 12 * 7);
    const first = history.length > 0 ? parseDateKey(toDateKey(history[0].created_at)) : today;
    const start = first < minStart ? first : minStart;

    // Align to the Sunday on/before `start` so weeks line up into full columns.
    const gridStart = new Date(start);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    const days: Date[] = [];
    for (let d = new Date(gridStart); d <= today; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
    }
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }

    return (
        <section className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
                <h4 className="font-serif text-base text-ink">Practice History</h4>
                <span className="text-xs text-muted">Your recent activity</span>
            </div>
            <div className="heatmap-scroll">
                <div className="heatmap-grid">
                    {weeks.map((week, weekIdx) => (
                        <div key={weekIdx} className="heatmap-week">
                            {week.map((day) => {
                                const key = localDateKey(day);
                                const entry = byDate.get(key);
                                const level = day > today ? undefined : intensityLevel(entry?.items_reviewed ?? 0);
                                const dayLabel = day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                                const title = entry
                                    ? `${dayLabel}\n${entry.items_reviewed} reviewed (${entry.items_correct} correct)\n${formatDuration(entry.time_studied_ms)} studied`
                                    : `${dayLabel}\nNo practice`;
                                return (
                                    <div
                                        key={key}
                                        className={level !== undefined ? `heatmap-cell heatmap-level-${level}` : "heatmap-cell heatmap-cell-empty"}
                                        onMouseEnter={(e) => setHovered({ x: e.clientX, y: e.clientY, text: title })}
                                        onMouseMove={(e) => setHovered({ x: e.clientX, y: e.clientY, text: title })}
                                        onMouseLeave={() => setHovered(null)}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            {hovered && (
                <div
                    className="heatmap-tooltip"
                    style={{ left: hovered.x, top: hovered.y }}
                >
                    {hovered.text}
                </div>
            )}
        </section>
    );
}
