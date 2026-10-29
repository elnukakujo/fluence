'use client';

import Lesson  from "@/interface/containers/Lesson";
import SharedBadge from "../collaboration/sharedBadge";
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm';

export default function LessonHeaderCard({ lesson }: { lesson: Lesson }) {
    return (
        <section className="card flex flex-col space-y-2">
            <div className="flex items-baseline gap-2">
                <h1>{lesson.title}</h1>
                {lesson.shared ? <SharedBadge fromOwner />
                    : lesson.collaborators && lesson.collaborators.length > 0
                        && <SharedBadge count={lesson.collaborators.length} />}
            </div>
            {lesson.description && <div className="index-divider pt-3 flex flex-col space-y-2">
                <Markdown remarkPlugins={[remarkGfm]}>{lesson.description}</Markdown>
            </div>}
        </section>
    );
}