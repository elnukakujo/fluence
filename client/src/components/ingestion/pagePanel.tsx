"use client";

import { useState } from "react";
import { pageImageUrl } from "@/api/ingestion";

// The original page next to the review. Prev/Next stay inside `range` (the lesson's pages). Sticky on wide
// screens; on narrow ones a bottom sheet opened from a button at the top.
export default function PagePanel({ jobId, page, range, onPage }: {
  jobId: string;
  page: number;
  range: [number, number];
  onPage: (page: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [first, last] = range;
  const shown = Math.min(Math.max(page, first), last);

  return (
    <div className="order-first lg:order-last lg:sticky lg:top-20 lg:w-80 lg:self-start xl:w-96">
      <button type="button" className="btn btn-secondary mb-2 lg:hidden" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide the page" : "Show the original page"}
      </button>
      <div className={`${open ? "fixed inset-x-0 bottom-0 z-40 max-h-[65vh] overflow-auto border-t shadow-lg" : "hidden"} flex-col gap-2 border-gray-300 bg-white p-3 lg:static lg:flex lg:max-h-none lg:rounded-lg lg:border lg:p-4 lg:shadow-none dark:border-gray-700 dark:bg-gray-950 ${open ? "flex" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="btn btn-secondary min-h-11" aria-label="Previous page" onClick={() => onPage(shown - 1)} disabled={shown <= first}>
            ← Prev
          </button>
          <span className="text-center text-sm font-medium" aria-live="polite">Page {shown} ({first}-{last})</span>
          <button type="button" className="btn btn-secondary min-h-11" aria-label="Next page" onClick={() => onPage(shown + 1)} disabled={shown >= last}>
            Next →
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pageImageUrl(jobId, shown)} alt={`Page ${shown} of the document`} className="mx-auto max-h-[60vh] w-auto object-contain lg:max-h-[75vh]" />
        <button type="button" className="btn btn-secondary lg:hidden" onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}
