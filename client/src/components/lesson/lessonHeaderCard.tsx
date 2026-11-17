'use client';

import { useTranslations } from "next-intl";
import Lesson from "@/interface/containers/Lesson";
import SharedBadge from "../collaboration/sharedBadge";
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm';

type Counts = { voc?: number; gram?: number; call?: number; ex?: number };       // a kind the course does not study is left out

/** The lesson's identity (title, shared badge, description), how much of each kind it holds, and as children its main action. */
export default function LessonHeaderCard({ lesson, counts, children }: { lesson: Lesson; counts?: Counts; children?: React.ReactNode }) {
    const t = useTranslations("study");
    const kinds = counts ? (["voc", "gram", "call", "ex"] as const).flatMap((k) => counts[k] === undefined ? [] : [[k, counts[k]] as const]) : [];
    return (
        <section className="card tile-hero grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 flex-col gap-3">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="text-4xl">{lesson.title}</h1>
                    {lesson.shared ? <SharedBadge fromOwner />
                        : lesson.collaborators && lesson.collaborators.length > 0
                            && <SharedBadge count={lesson.collaborators.length} />}
                </header>
                {lesson.description && <div className="prose-sm text-muted">
                    <Markdown remarkPlugins={[remarkGfm]}>{lesson.description}</Markdown>
                </div>}
                {children && <div className="mt-auto pt-2">{children}</div>}
            </div>
            {kinds.length > 0 && (
                <ul className="grid list-none grid-cols-2 gap-4 pl-0 sm:grid-cols-4 md:grid-cols-2 md:border-l md:border-dashed md:border-border md:pl-6" aria-label={t("lessonContents")}>
                    {kinds.map(([kind, n]) => <li key={kind} className="figure"><b>{n}</b><span>{t(`section_${kind}`)}</span></li>)}
                </ul>
            )}
        </section>
    );
}
