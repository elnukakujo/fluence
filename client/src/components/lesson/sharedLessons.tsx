"use client";

import { useEffect, useState } from "react";
import { getSharedLessons, leaveSharedLesson } from "@/api/lesson";
import LessonOverviewCard from "@/components/lesson/lessonOverviewCard";
import type Lesson from "@/interface/containers/Lesson";

export default function SharedLessons({ language_code }: { language_code: string }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      setLessons(await getSharedLessons());
    } catch {}
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  if (!loaded || lessons.length === 0) return null;

  async function stopSharing(lessonId: string) {
    try {
      await leaveSharedLesson(lessonId);
      setLessons((ls) => ls.filter((l) => l.id !== lessonId));
    } catch (e) {
      console.error("Failed to stop sharing:", e);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-serif">Shared with you</h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 list-none">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="flex flex-col gap-1">
            <LessonOverviewCard language_code={language_code} lesson={lesson} languageId={lesson.language_id} shared />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => stopSharing(lesson.id)}
            >
              Stop sharing
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
