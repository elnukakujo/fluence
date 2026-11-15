"use client";

export default function SectionCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <article className="card flex flex-col gap-3 w-full">
            <h2>{title}</h2>
            <div className="index-divider" />
            {children}
        </article>
    );
}
