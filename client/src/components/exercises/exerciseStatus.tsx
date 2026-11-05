import { CheckCircle2, AlertTriangle, Ban } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type Exercise from "@/interface/features/Exercise";

/** Ready / Not ready badge, shown on every exercise. "Not ready" lists what is missing (`exercise.needs`). */
export default async function ExerciseStatus({ exercise }: { exercise: Exercise }) {
    const t = await getTranslations("exercises");
    const tStudy = await getTranslations("study");
    const needs = exercise.needs ?? [];
    const banned = exercise.banned ? <span className="badge badge-warn"><Ban size={13} aria-hidden />{tStudy("banned")}</span> : null;
    if (!needs.length) return <><span className="badge badge-ok"><CheckCircle2 size={13} aria-hidden />{t("statusReady")}</span>{banned}</>;
    const missing = t("statusMissing", { what: needs.map((n) => t(`need_${n}`)).join(", ") });
    return <><span className="badge badge-warn" title={missing}><AlertTriangle size={13} aria-hidden />{t("statusNotReady")}<span className="sr-only"> — {missing}</span></span>{banned}</>;
}
