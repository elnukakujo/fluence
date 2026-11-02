"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { pageImageUrl } from "@/api/ingestion";
import PagePanel from "./pagePanel";

type Kind = "vocabulary" | "grammar" | "calligraphy" | "exercise";

type Props = {
  pages: number[];
  value: Record<number, Kind[]>;
  onChange: (value: Record<number, Kind[]>) => void;
  jobId?: string;
  onFocusPage?: (page: number) => void;
};

const KINDS: Kind[] = ["vocabulary", "grammar", "calligraphy", "exercise"];

function getKindLabel(kind: Kind, t: ReturnType<typeof useTranslations>): string {
  if (kind === "calligraphy") return t("calligraphyLabel");
  const map = { vocabulary: "vocabularyLabel", grammar: "grammarLabel", exercise: "exerciseLabel" } as const;
  return t(map[kind] || kind);
}

export default function PageKinds({ pages, value, onChange, jobId, onFocusPage }: Props) {
  const t = useTranslations("ingestion");
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
            <li key={page} className="card flex flex-col gap-2" onFocus={() => onFocusPage?.(page)} onClick={() => onFocusPage?.(page)}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-shrink-0">
                  <p className="text-sm font-medium">{t("pageDisplay", { page })}</p>
                  {jobId && (
                    <img
                      src={pageImageUrl(jobId, page)}
                      alt={t("pageImageAlt", { page })}
                      loading="lazy"
                      className="mt-2 h-24 w-auto object-contain"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div role="group" aria-label={`Kinds on page ${page}`} className="flex flex-wrap gap-2">
                    {KINDS.map((kind) => {
                      const isActive = kindsForPage.includes(kind);
                      return (
                        <button
                          key={kind}
                          type="button"
                          aria-pressed={isActive}
                          className="chip min-h-11 px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          style={isActive ? { background: "var(--color-primary)", color: "var(--color-primary-foreground)" } : undefined}
                          onClick={() => toggleKind(page, kind)}
                        >
                          {isActive ? "✓ " : ""}{getKindLabel(kind, t)}
                        </button>
                      );
                    })}
                  </div>
                  {isEmpty && <p className="mt-2 text-sm opacity-70 italic">{t("skipped")}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The kinds list with the original page beside it, limited to these pages; the page last touched is the one shown.
export function PageKindsWithViewer({ jobId, pages, ...rest }: Props & { jobId: string }) {
  const [page, setPage] = useState(pages[0]);
  if (pages.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
      <div className="min-w-0 flex-1"><PageKinds {...rest} pages={pages} jobId={jobId} onFocusPage={setPage} /></div>
      <PagePanel jobId={jobId} page={page} range={[pages[0], pages[pages.length - 1]]} pages={pages} onPage={setPage} />
    </div>
  );
}
