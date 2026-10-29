"use client";

import { useEffect, useState } from "react";
import { getSharedLessons } from "@/api/lesson";
import LessonOverviewCard from "@/components/lesson/lessonOverviewCard";
import type Lesson from "@/interface/containers/Lesson";

export default function SharedLessons({ language_code }: { language_code: string }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSharedLessons()
      .then((l) => setLessons(l))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || lessons.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-serif">Shared with you</h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 list-none">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <LessonOverviewCard language_code={language_code} lesson={lesson} languageId={lesson.language_id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
