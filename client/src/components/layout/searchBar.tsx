"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { searchElements, type SearchCategory, type SearchResult } from "@/api/search";

const BADGE_COLORS: Record<SearchCategory, string> = {
  container: "bg-pink-100 text-pink-800",
  feature: "bg-yellow-100 text-yellow-800",
  component: "bg-blue-100 text-blue-800",
};

export default function SearchBar({ currentUserId }: { currentUserId: string | null }) {
  const t = useTranslations("search");
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 1) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await searchElements(trimmedQuery, currentUserId, controller.signal);
        setResults(response.results);
        setIsOpen(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setIsOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, currentUserId]);

  const resolveSearchPath = (result: SearchResult): string => {
    if (result.type === "language") {
      return `/languages/${result.id}`;
    }

    if (result.type === "lesson" && result.language_id) {
      return `/languages/${result.language_id}/lesson/${result.id}`;
    }

    if (result.type === "vocabulary" && result.language_id && result.lesson_id) {
      return `/languages/${result.language_id}/lesson/${result.lesson_id}/voc/${result.id}`;
    }

    if (result.type === "grammar" && result.language_id && result.lesson_id) {
      return `/languages/${result.language_id}/lesson/${result.lesson_id}/gram/${result.id}`;
    }

    if (result.type === "calligraphy" && result.language_id && result.lesson_id) {
      return `/languages/${result.language_id}/lesson/${result.lesson_id}/call/${result.id}`;
    }

    if (result.type === "exercise" && result.language_id && result.lesson_id) {
      return `/languages/${result.language_id}/lesson/${result.lesson_id}/ex/${result.id}`;
    }

    if (result.type === "word" && result.language_id) {
      return `/languages/${result.language_id}/word/${result.id}`;
    }

    if (result.type === "character" && result.language_id) {
      return `/languages/${result.language_id}/character/${result.id}`;
    }

    if (result.type === "passage" && result.language_id) {
      return `/languages/${result.language_id}/passage/${result.id}`;
    }

    return `/${result.type}/${result.id}`;
  };

  const handleSelect = (result: SearchResult) => {
    const path = resolveSearchPath(result);
    setIsOpen(false);
    setQuery("");
    router.push(path);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (query.trim().length >= 1) {
              setIsOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder={t("placeholder")}
          className="input rounded-full pr-10"
        />
        {isLoading && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
          </span>
        )}
      </div>

      {isOpen && query.trim().length >= 1 && (
        <div className="card absolute mt-2 w-full overflow-hidden p-0 shadow-xl">
          {results.length > 0 ? (
            <ul className="max-h-80 list-none overflow-y-auto py-1">
              {results.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-accent-soft"
                  >
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${BADGE_COLORS[result.category]}`}
                    >
                      {result.category}
                    </span>
                    <span className="truncate text-sm text-foreground">{result.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : !isLoading ? (
            <div className="px-3 py-3 text-sm text-muted">{t("noResults")}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
