"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";
import type Grammar from "@/interface/features/Grammar";
import ListCard, { average } from "./listCard";
import { SelectableList } from "./itemSelection";

export default function GrammarList({ gramProps }: { gramProps: Grammar[] }) {
    const t = useTranslations("grammar");
    const { language_id, lesson_id } = useParams<{ language_id: string, lesson_id: string }>();
    const router = useRouter();
    const base = `/languages/${language_id}/lesson/${lesson_id}/gram`;
    const rows = [...gramProps].sort((a, b) => (a.score || 0) - (b.score || 0)).map((i) => ({ id: i.id!, main: i.title }));

    return (
        <ListCard selectKind="gram" icon={BookOpen} title={t("heading")} count={gramProps.length} score={average(gramProps, (i) => i.score)} difficulty={average(gramProps, (i) => i.difficulty)}
            addPath={`${base}/new`} practicePath={`${base}/flashcard`}>
            <SelectableList kind="gram" items={rows} onOpen={(id) => router.push(`${base}/${id}`)} />
        </ListCard>
    );
}
