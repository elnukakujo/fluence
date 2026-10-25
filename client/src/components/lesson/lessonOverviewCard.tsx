"use client";

import { useParams, useRouter } from 'next/navigation';
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import type Lesson from "@/interface/containers/Lesson";
import { languageProficiencySystems, getLevelLabel } from '@/utils/language_iso639';
import ScoreDisplay from '../ui/displays/scoreDisplay';

export default function LessonOverviewCard({ language_code, lesson }: { language_code: string; lesson: Lesson }) {
    const { language_id } = useParams();
    const router = useRouter();
    const handleClick = () => {
        router.push(`/languages/${language_id}/lesson/${lesson.id}`);
    };
    const system = languageProficiencySystems[language_code];
    const levelLabel = getLevelLabel(system, lesson.level);
    return (
        <button
            className="card overview-card flex flex-col gap-2 overflow-hidden text-left cursor-pointer transition hover:-translate-y-0.5 hover:bg-accent-soft hover:shadow-md"
            onClick={handleClick}
        >
            <header className="flex flex-col">
                <h3 className="font-serif text-lg text-ink line-clamp-1">{lesson.title}</h3>
            </header>
            <div className="index-divider line-clamp-4 flex-1 text-sm text-muted prose-sm">
                <Markdown remarkPlugins={[remarkGfm]}>{lesson.description}</Markdown>
            </div>
            <footer>
                <h5 className="text-xs uppercase tracking-wide text-muted">{levelLabel}</h5>
                <ScoreDisplay score={lesson.score} />
            </footer>
        </button>
    );
}