"use client";

import { useTranslations } from "next-intl";

// "Step 2 of 3" with a segmented bar: 1 upload, 2 choose the pages / lessons, 3 review. Done segments are filled, the current one is stronger.
export default function StepProgress({ step, second }: { step: 1 | 2 | 3; second: string }) {
  const t = useTranslations("ingestion");
  const names = [t("uploadTheDocument"), second, t("reviewAndAdd")];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{t("stepProgressTitle", { step, stepName: names[step - 1] })}</p>
      <div role="progressbar" aria-label={t("stepProgressAriaLabel")} aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} className="grid grid-cols-3 gap-1.5">
        {names.map((n, i) => (
          <span key={n} title={n} className="step-seg h-1.5 rounded-full" data-state={i + 1 < step ? "done" : i + 1 === step ? "current" : "todo"} />
        ))}
      </div>
    </div>
  );
}
