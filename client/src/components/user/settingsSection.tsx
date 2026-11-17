"use client";

import { NestedSectionContext } from "@/components/ui/sectionCard";

/** One section of the Settings page: a single card with the section title, and its blocks separated by a thin line. */
export default function SettingsSection({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section id={id} aria-labelledby={`${id}-title`}>
            <article className="card flex w-full flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h2 id={`${id}-title`}>{title}</h2>
                    {hint && <p className="text-sm text-muted">{hint}</p>}
                </div>
                <NestedSectionContext.Provider value={true}>
                    <div className="flex flex-col gap-5 [&>*+*]:border-t [&>*+*]:border-border [&>*+*]:pt-5">{children}</div>
                </NestedSectionContext.Provider>
            </article>
        </section>
    );
}
