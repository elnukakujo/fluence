'use client';

import Lesson  from "@/interface/containers/Lesson";
import Markdown from "react-markdown";
import remarkGfm from 'remark-gfm';

export default function LessonHeaderCard({ lesson }: { lesson: Lesson }) {
    return (
        <section className="card flex flex-col space-y-2">
            <div className="flex items-baseline gap-2">
                <h1>{lesson.title}</h1>
                {lesson.collaborators && lesson.collaborators.length > 0 && (
                    <span className="badge">Collaborative</span>
                )}
            </div>
            {lesson.description && <div className="index-divider pt-3 flex flex-col space-y-2">
                <Markdown remarkPlugins={[remarkGfm]}>{lesson.description}</Markdown>
            </div>}
        </section>
    );
}