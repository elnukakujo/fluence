"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PenLine } from "lucide-react";
import type Calligraphy from "@/interface/features/Calligraphy";
import ListCard, { average } from "./listCard";
import { SelectableList } from "./itemSelection";

export default function CalligraphyList({ callProps }: { callProps: Calligraphy[] }) {
    const t = useTranslations("calligraphy");
    const { language_id, lesson_id } = useParams<{ language_id: string, lesson_id: string }>();
    const router = useRouter();
    const base = `/languages/${language_id}/lesson/${lesson_id}/call`;
    const rows = [...callProps].sort((a, b) => (a.score || 0) - (b.score || 0)).map((i) => ({ id: i.id!, main: i.character.character ?? "", sub: i.character.phonetic ?? undefined, glyph: true }));

    return (
        <ListCard selectKind="call" icon={PenLine} title={t("heading")} count={callProps.length} score={average(callProps, (i) => i.score)} difficulty={average(callProps, (i) => i.difficulty)}
            addPath={`${base}/new`} practicePath={`${base}/flashcard`}>
            <SelectableList kind="call" items={rows} onOpen={(id) => router.push(`${base}/${id}`)} />
        </ListCard>
    );
}
