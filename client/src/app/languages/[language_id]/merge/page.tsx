import Link from "next/link";
import { getTranslations } from "next-intl/server";
import MergeLessons from "@/components/lesson/mergeLessons";
import { getLanguageById } from "@/api/language";
import { getLessonById } from "@/api/lesson";
import type Lesson from "@/interface/containers/Lesson";
import { languageProficiencySystems } from "@/utils/language_iso639";

const DEFAULT_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default async function MergePage({ params, searchParams }: {
  params: Promise<{ language_id: string }>; searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const t = await getTranslations("lesson");
  const { language_id } = await params;
  const { a, b } = await searchParams;
  const back = <Link className="link underline" href={`/languages/${language_id}`}>{t("backToLanguage")}</Link>;
  const load = (id?: string): Promise<Lesson | null> => (id ? getLessonById(id).catch(() => null) : Promise.resolve(null));
  const [first, second] = await Promise.all([load(a), load(b)]);
  if (!first || !second || first.id === second.id || first.language_id !== language_id || second.language_id !== language_id) {
    return <main className="card max-w-2xl"><p role="alert">{t("mergeInvalid")}</p>{back}</main>;
  }
  const language = await getLanguageById(language_id);
  const levelOptions = languageProficiencySystems[language.target_iso639_2t ?? ""]?.levels.map((l) => l.code) ?? DEFAULT_LEVELS;
  return <main><MergeLessons languageId={language_id} a={first} b={second} levelOptions={levelOptions} /></main>;
}
