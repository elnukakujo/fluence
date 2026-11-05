"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

/** Reorderable list. Drag the handle (mouse or touch), or focus it and press the arrow keys. */
export default function SortableList({ ids, onReorder, handleLabel, children }: {
    ids: string[];
    onReorder: (ids: string[]) => void;
    handleLabel: (id: string) => string;
    children: (id: string, index: number) => ReactNode;
}) {
    const rows = useRef<Record<string, HTMLLIElement | null>>({});
    const [dragging, setDragging] = useState<string | null>(null);
    const move = (id: string, to: number) => {
        const rest = ids.filter((i) => i !== id);
        const next = [...rest.slice(0, to), id, ...rest.slice(to)];
        if (next.some((v, i) => v !== ids[i])) onReorder(next);
    };
    const drag = (id: string, e: PointerEvent<HTMLButtonElement>) => {
        if (dragging !== id) return;
        // insertion index = how many other rows have their midpoint above the pointer
        const to = ids.filter((i) => i !== id).filter((i) => { const r = rows.current[i]!.getBoundingClientRect(); return e.clientY > r.top + r.height / 2; }).length;
        move(id, to);
    };
    const key = (id: string, i: number, e: KeyboardEvent) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        move(id, Math.max(0, Math.min(ids.length - 1, i + (e.key === "ArrowUp" ? -1 : 1))));
    };
    return (
        <ol className="flex flex-col gap-2 list-none pl-0">
            {ids.map((id, i) => (
                <li key={id} ref={(el) => { rows.current[id] = el; }} className="sort-row" data-dragging={dragging === id}>
                    <button type="button" className="sort-handle" aria-label={handleLabel(id)} aria-keyshortcuts="ArrowUp ArrowDown"
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(id); }}
                        onPointerMove={(e) => drag(id, e)}
                        onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}
                        onKeyDown={(e) => key(id, i, e)}>
                        <GripVertical size={18} aria-hidden />
                    </button>
                    {children(id, i)}
                </li>
            ))}
        </ol>
    );
}
