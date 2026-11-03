import { getTranslations } from "next-intl/server";
import MergeLabels from "@/components/labels/mergeLabels";
import { getSourceById } from "@/api/source";
import type Source from "@/interface/systemData/Source";

export default async function MergeSourcesPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const t = await getTranslations("labels");
  const { a, b } = await searchParams;
  const load = (id?: string): Promise<Source | null> => (id ? getSourceById(id).catch(() => null) : Promise.resolve(null));
  const [first, second] = await Promise.all([load(a), load(b)]);
  if (!first || !second || first.id === second.id) return <main className="card max-w-2xl"><p role="alert">{t("invalid")}</p></main>;
  return <MergeLabels kind="source" a={first} b={second} />;
}
