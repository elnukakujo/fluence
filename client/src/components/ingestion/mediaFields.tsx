"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { pageImageUrl, uploadMedia } from "@/api/ingestion";
import type { Row } from "@/lib/ingestion/review";

// Support picture and spoken lines of one item. The detected picture and the lines come from the document; the user can
// switch the picture off, replace it, or replace any line's audio. Nothing is stored until the item is added.
export default function MediaFields({ row, jobId, ttsAvailable, onPatch }: {
  row: Row; jobId: string; ttsAvailable: boolean; onPatch: (change: Partial<Row>) => void;
}) {
  const t = useTranslations("ingestion");
  const [error, setError] = useState<string | null>(null);
  const crop = row.candidate.image_crop;
  const lines = row.candidate.audio_lines ?? [];
  if (!crop && lines.length === 0) return null;

  const upload = async (file: File | undefined, kind: "image" | "audio", done: (u: { id: string; name: string }) => void) => {
    if (!file) return;
    setError(null);
    try {
      const r = await uploadMedia(jobId, file);
      if (r.kind !== kind) return setError(kind === "image" ? t("chooseImageFile") : t("chooseAudioFile"));
      done({ id: r.id, name: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("couldNotUploadFile"));
    }
  };

  const [pw, ph] = crop?.page_size ?? [1, 1];
  const [x0, y0, x1, y1] = crop?.bbox ?? [0, 0, 1, 1];
  const cw = x1 - x0, ch = y1 - y0;

  return (
    <div className="flex flex-col gap-3 rounded border border-dashed border-gray-300 p-3 dark:border-gray-700" aria-label={t("supportMedia")}>
      {crop && (
        <div className="flex flex-col gap-2">
          <p className="field-label">{t("pictureFound")}</p>
          <div role="img" aria-label={t("croppedPictureAlt")} className="w-full max-w-xs rounded border border-gray-300 bg-white bg-no-repeat dark:border-gray-700"
            style={{
              aspectRatio: `${cw} / ${ch}`,
              backgroundImage: `url(${pageImageUrl(jobId, crop.page + 1)})`,
              backgroundSize: `${(pw / cw) * 100}% auto`,
              backgroundPosition: `${pw === cw ? 0 : (x0 / (pw - cw)) * 100}% ${ph === ch ? 0 : (y0 / (ph - ch)) * 100}%`,
            }} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!row.useCrop && !row.imageUpload} disabled={!!row.imageUpload}
              onChange={(e) => onPatch({ useCrop: e.target.checked })} />
            {t("addItAsImage")}
          </label>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="field-label" htmlFor={`img-${row.candidate.id}`}>{crop ? t("orUseOwnPicture") : t("supportPictureOptional")}</label>
        <input id={`img-${row.candidate.id}`} className="input" type="file" accept="image/*"
          onChange={(e) => upload(e.target.files?.[0], "image", (u) => onPatch({ imageUpload: u }))} />
        {row.imageUpload && (
          <p className="text-sm">{t("usingFile", { name: row.imageUpload.name })}{" "}
            <button type="button" className="link underline" onClick={() => onPatch({ imageUpload: undefined })}>{t("removeButton")}</button></p>
        )}
      </div>
      {lines.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="field-label">
            {t(ttsAvailable ? "audioSummaryTts" : "audioSummaryNoTts", { count: lines.length })}
          </p>
          <ul className="flex flex-col gap-2">
            {lines.map((line, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 break-words">{line}</span>
                {row.audioUploads?.[i] ? (
                  <span>{row.audioUploads[i].name}{" "}
                    <button type="button" className="link underline" onClick={() => {
                      const { [i]: _gone, ...rest } = row.audioUploads ?? {};
                      onPatch({ audioUploads: rest });
                    }}>{t("removeButton")}</button></span>
                ) : (
                  <input type="file" accept="audio/*" aria-label={t("replaceAudioLine", { n: i + 1 })} className="input w-auto"
                    onChange={(e) => upload(e.target.files?.[0], "audio", (u) => onPatch({ audioUploads: { ...row.audioUploads, [i]: u } }))} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p>}
    </div>
  );
}
