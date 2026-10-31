"use client";

import { pageImageUrl } from "@/api/ingestion";

export default function PagePanel({
  jobId, page, pageCount, onPage,
}: {
  jobId: string;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  const handlePrev = () => page > 1 && onPage(page - 1);
  const handleNext = () => page < pageCount && onPage(page + 1);

  return (
    <div className="sticky top-0 flex flex-col gap-2 rounded-lg border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handlePrev}
          disabled={page <= 1}
        >
          ← Prev
        </button>
        <span className="text-sm font-medium">
          Page {page} / {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleNext}
          disabled={page >= pageCount}
        >
          Next →
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pageImageUrl(jobId, page)}
        alt={`Page ${page} of the document`}
        className="mx-auto max-h-96 w-auto object-contain"
      />
    </div>
  );
}
