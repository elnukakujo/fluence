"use client";

import { createContext, useContext } from "react";

/** True inside a `SettingsSection`: its blocks are parts of one card, so they drop their own card and use a quieter heading. */
export const NestedSectionContext = createContext(false);

/** A titled block. On its own it is a card. Inside a `SettingsSection` it is a plain block under an h3 (`quiet`: the section's own
 *  title is enough, the heading stays for screen readers); `fold` makes it a closed `<details>` the reader opens when needed. */
export default function SectionCard({
    title,
    children,
    fold = false,
    quiet = false,
}: {
    title: string;
    children: React.ReactNode;
    fold?: boolean;
    quiet?: boolean;
}) {
    const nested = useContext(NestedSectionContext);
    if (!nested) {
        return (
            <article className="card flex flex-col gap-3 w-full">
                <h2>{title}</h2>
                <div className="index-divider" />
                {children}
            </article>
        );
    }
    if (fold) {
        return (
            <details className="settings-fold group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-base font-semibold [&::-webkit-details-marker]:hidden">
                    <span>{title}</span>
                    <span aria-hidden className="text-muted transition-transform group-open:rotate-90">›</span>
                </summary>
                <div className="flex flex-col gap-3 pb-1 pt-2">{children}</div>
            </details>
        );
    }
    return (
        <div className="flex flex-col gap-3">
            <h3 className={quiet ? "sr-only" : "text-base font-semibold"}>{title}</h3>
            {children}
        </div>
    );
}
