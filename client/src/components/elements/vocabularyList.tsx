"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import type Vocabulary from "@/interface/features/Vocabulary";
import ListCard, { average } from "./listCard";
import { SelectableList } from "./itemSelection";

export default function VocabularyList({ vocProps }: { vocProps: Vocabulary[] }) {
    const t = useTranslations("vocabulary");
    const { language_id, lesson_id } = useParams<{ language_id: string, lesson_id: string }>();
    const router = useRouter();
    const base = `/languages/${language_id}/lesson/${lesson_id}/voc`;
    const rows = [...vocProps].sort((a, b) => (a.score || 0) - (b.score || 0)).map((i) => ({ id: i.id!, main: i.word.word ?? "", sub: i.word.translation ?? undefined }));

    return (
        <ListCard selectKind="voc" icon={Languages} title={t("heading")} count={vocProps.length} score={average(vocProps, (i) => i.score)} difficulty={average(vocProps, (i) => i.difficulty)}
            addPath={`${base}/new`} practicePath={`${base}/flashcard`}>
            <SelectableList kind="voc" items={rows} onOpen={(id) => router.push(`${base}/${id}`)} />
        </ListCard>
    );
}
