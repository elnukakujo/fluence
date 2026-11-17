import type { ReactNode } from "react";

/** One titled card of an element form: related fields grouped under a heading, in a responsive grid. */
export function FormSection({ title, description, children, columns = 2 }: { title: string; description?: string; children: ReactNode; columns?: 1 | 2 | 3 | 4 }) {
    const grid = columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "";
    return (
        <section className="card flex flex-col gap-4">
            <header className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{title}</h2>
                {description && <p className="text-sm text-muted">{description}</p>}
            </header>
            <div className={`grid gap-4 ${grid}`.trim()}>{children}</div>
        </section>
    );
}

/** The form column: one readable width, centred, with the same gap between sections in every element form. */
export function FormLayout({ onSubmit, children }: { onSubmit: React.FormEventHandler<HTMLFormElement>; children: ReactNode }) {
    return <form className="flex w-full flex-col gap-6" onSubmit={onSubmit}>{children}</form>;
}

/** The save bar: stays at the bottom of the viewport so the action is never a long scroll away. */
export function FormActions({ note, children }: { note?: string; children: ReactNode }) {
    return (
        <div className="sticky bottom-0 z-[60] pb-[calc(0.75rem+env(safe-area-inset-bottom))] -mx-2 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-2 pt-3 backdrop-blur">
            <p className="text-sm text-muted">{note}</p>
            <div className="flex gap-3">{children}</div>
        </div>
    );
}

/** Spans the whole grid row (media pickers, selectors). */
export function FullRow({ children }: { children: ReactNode }) {
    return <div className="flex flex-col gap-3 sm:col-span-full">{children}</div>;
}

/** The label style of the element forms (the compact `field-label` stays for the import review). */
export const FORM_LABEL = "text-sm font-medium text-foreground";

/** Optional detail inside a card (the media of an example): closed until opened, with a count so nothing is hidden silently. */
export function Disclosure({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
    return (
        <details className="group rounded-xl border border-border sm:col-span-full">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium text-foreground">
                <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
                {title}{count ? <span className="chip pointer-events-none">{count}</span> : null}
            </summary>
            <div className="px-3 pb-3">{children}</div>
        </details>
    );
}
