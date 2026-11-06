"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";

/** Asks which type to rebuild an exercise as (blank = the model chooses) and, for a single card, an optional request. */
export default function RegenerateForm({ withRequest, busy, onSubmit, onCancel }: {
  withRequest: boolean;
  busy: boolean;
  onSubmit: (opts: { exercise_type?: string; request?: string }) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("ingestion");
  const tEx = useTranslations("exercises");
  const [type, setType] = useState("");
  const [request, setRequest] = useState("");
  return (
    <form className="card flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); onSubmit({ exercise_type: type || undefined, request: request.trim() || undefined }); }}>
      <label className="flex flex-col gap-1">
        <span className="field-label">{withRequest ? t("regenerateType") : t("mergeType")}</span>
        <select className="input min-h-11" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t("regenerateAuto")}</option>
          {Object.entries(EXERCISE_TYPE_KEY).map(([id, key]) => <option key={id} value={id}>{tEx(key)}</option>)}
        </select>
      </label>
      {withRequest && (
        <label className="flex flex-col gap-1">
          <span className="field-label">{t("regenerateRequest")}</span>
          <textarea className="input input-grow" value={request} placeholder={t("regenerateRequestHint")} onChange={(e) => setRequest(e.target.value)} />
        </label>
      )}
      <div className="btn-row flex-wrap">
        <button type="submit" className="btn btn-primary min-h-11" disabled={busy}>{busy ? t("reloading") : t("regenerateGo")}</button>
        <button type="button" className="btn btn-secondary min-h-11" onClick={onCancel}>{t("cancel")}</button>
      </div>
    </form>
  );
}
