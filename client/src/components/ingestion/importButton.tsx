"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { type Capabilities, getCapabilities } from "@/api/ingestion";

// Always rendered. When the user can't import it is greyed out with the reasons on hover/focus.
// aria-disabled (not `disabled`) so it still receives hover, focus and click: browsers swallow
// those on a truly disabled button, which would hide the explanation.
export default function ImportButton({ languageId, lessonId, settingsHref }: {
  languageId: string;
  lessonId: string;
  settingsHref?: string;
}) {
  const router = useRouter();
  const tipId = useId();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getCapabilities(languageId, lessonId).then((c) => alive && setCaps(c)).catch(() => alive && setLoadFailed(true));
    return () => { alive = false; };
  }, [languageId, lessonId]);

  const disabled = loadFailed || !caps || !caps.can_import;
  const reasons = loadFailed
    ? ["Couldn't check your settings - reload the page to try again."]
    : !caps ? ["Checking whether you can import..."] : caps.reasons.map((r) => r.message);
  const needsSettings = !!caps?.reasons.some((r) => r.code === "no_text_endpoint");

  return (
    <div className="group relative inline-block">
      <button
        type="button"
        className={`btn btn-secondary ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        aria-disabled={disabled}
        aria-describedby={disabled ? tipId : undefined}
        onClick={() => disabled ? setOpen((o) => !o) : router.push(`/languages/${languageId}/lesson/${lessonId}/import`)}
        onBlur={() => setOpen(false)}
      >
        <p>Import from a document</p>
      </button>
      {disabled && (
        <div
          id={tipId}
          role="tooltip"
          className={`card absolute left-0 top-full z-30 mt-2 w-72 max-w-[80vw] text-sm shadow-lg ${
            open ? "visible" : "invisible group-hover:visible group-focus-within:visible"}`}
        >
          <p className="mb-1 font-medium">Not available yet</p>
          <ul className="list-disc pl-4">
            {reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          {needsSettings && settingsHref && (
            <Link href={settingsHref} className="link mt-2 inline-block">Go to Settings</Link>
          )}
        </div>
      )}
    </div>
  );
}
