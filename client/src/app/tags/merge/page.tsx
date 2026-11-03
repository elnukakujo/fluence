import { getTranslations } from "next-intl/server";
import MergeLabels from "@/components/labels/mergeLabels";
import { getTagById } from "@/api/tag";
import type Tag from "@/interface/systemData/Tag";

export default async function MergeTagsPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const t = await getTranslations("labels");
  const { a, b } = await searchParams;
  const load = (id?: string): Promise<Tag | null> => (id ? getTagById(id).catch(() => null) : Promise.resolve(null));
  const [first, second] = await Promise.all([load(a), load(b)]);
  if (!first || !second || first.id === second.id) return <main className="card max-w-2xl"><p role="alert">{t("invalid")}</p></main>;
  return <MergeLabels kind="tag" a={first} b={second} />;
}
