import { CheckCircle2, AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type Exercise from "@/interface/features/Exercise";

/** Ready / Not ready badge, shown on every exercise. "Not ready" lists what is missing (`exercise.needs`). */
export default async function ExerciseStatus({ exercise }: { exercise: Exercise }) {
    const t = await getTranslations("exercises");
    const needs = exercise.needs ?? [];
    if (!needs.length) return <span className="badge badge-ok"><CheckCircle2 size={13} aria-hidden />{t("statusReady")}</span>;
    const missing = t("statusMissing", { what: needs.map((n) => t(`need_${n}`)).join(", ") });
    return <span className="badge badge-warn" title={missing}><AlertTriangle size={13} aria-hidden />{t("statusNotReady")}<span className="sr-only"> — {missing}</span></span>;
}
