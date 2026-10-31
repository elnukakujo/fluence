"use client";

import { pageImageUrl } from "@/api/ingestion";

type Kind = "vocabulary" | "grammar" | "passage" | "character";

type Props = {
  pages: number[];
  value: Record<number, Kind[]>;
  onChange: (value: Record<number, Kind[]>) => void;
  jobId?: string;
};

const KINDS: Kind[] = ["vocabulary", "grammar", "passage", "character"];

export default function PageKinds({ pages, value, onChange, jobId }: Props) {
  const toggleKind = (page: number, kind: Kind) => {
    const currentKinds = value[page] || [];
    const newKinds = currentKinds.includes(kind)
      ? currentKinds.filter((k) => k !== kind)
      : [...currentKinds, kind];
    onChange({ ...value, [page]: newKinds });
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {pages.map((page) => {
          const kindsForPage = value[page] || [];
          const isEmpty = kindsForPage.length === 0;
          return (
            <li key={page} className="card flex flex-col gap-2">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-shrink-0">
                  <p className="text-sm font-medium">Page {page}</p>
                  {jobId && (
                    <img
                      src={pageImageUrl(jobId, page)}
                      alt={`Preview of page ${page}`}
                      className="mt-2 h-24 w-auto object-contain"
                    />
                  )}
                </div>
                <div className="flex-1">
                  {isEmpty ? (
                    <p className="text-sm opacity-70 italic">Nothing here or contents page - skipped</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {KINDS.map((kind) => {
                        const isActive = kindsForPage.includes(kind);
                        return (
                          <button
                            key={kind}
                            type="button"
                            aria-pressed={isActive}
                            className={`chip ${isActive ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => toggleKind(page, kind)}
                          >
                            {kind.charAt(0).toUpperCase() + kind.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
