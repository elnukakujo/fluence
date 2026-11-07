"use client";

import { useTranslations } from "next-intl";
import ProgressBar from "@/components/ui/progressBar";

/** Progress of a generation job. Determinate while exercises are being written; indeterminate before the first one and while the finished batch is checked and saved
 *  (the numbers say 12 / 12 but the work is not over). The moving highlight is switched off by the stylesheet for reduced motion. */
export default function GenerationProgress({ done, total }: { done: number; total: number }) {
    const t = useTranslations("exercises");
    const starting = done <= 0;
    const finishing = !starting && done >= total;
    const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const indeterminate = starting || finishing;
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
                <p role="status" aria-live="polite" className="text-sm font-medium">
                    {starting ? t("generateStarting") : finishing ? t("generateFinishing") : t("generateRunning", { done, total })}
                </p>
                {!indeterminate && <span className="font-serif text-2xl font-semibold tabular-nums">{percent}%</span>}
            </div>
            <ProgressBar current={done} total={total} showLabel={false} showPercent={false} active indeterminate={indeterminate} ariaLabel={t("generateTitle")} />
        </div>
    );
}
