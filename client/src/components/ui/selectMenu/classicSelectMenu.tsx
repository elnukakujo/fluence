"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";
import EmptyState from "@/components/ui/emptyState";

export type SelectGroup = { label: string; options: string[] };

/**
 * THE dropdown of the whole app (rule: docs/rules/ui-components.md): one choice or several, from a short list or a long one.
 * - Type to filter (the label, the hint and any extra search words), arrows + Enter to pick, Escape to close, Home/End to jump.
 * - `groups` puts the options under headings (exercise types, strokes, ...); `optionHint` adds a second line; `optionSearch` adds hidden search words.
 * - Short lists (up to 7 options) do not offer typing unless `searchable` says so, so a phone keyboard does not pop up.
 * Options are plain strings (the stored value); `optionLabel` decides what is shown.
 */
export default function ClassicSelectMenu({
  label,
  ariaLabel,
  options,
  selectedOption,
  onChange,
  required = false,
  multiple = false,
  optionLabel,
  chipLabel,
  optionHint,
  optionSearch,
  groups,
  placeholder,
  disabled = false,
  clearable = false,
  searchable,
  optionColor,
  onCreate,
  createLabel,
  loading = false,
  valueClassName = "",
  className = "w-full max-w-64",
  lang,
}: {
  label?: string;
  /** The accessible name when there is no visible label (a dropdown inside a table row or a toolbar). */
  ariaLabel?: string;
  options: string[];
  selectedOption: string | string[];
  onChange: (value: string | string[]) => void;
  required?: boolean;
  multiple?: boolean;
  /** Display mapping for the options (the value stays untouched). */
  optionLabel?: (value: string) => string | undefined;
  /** What a chosen value shows as a chip in multiple mode (default: the option label). */
  chipLabel?: (value: string) => string | undefined;
  /** A second, quieter line under an option. */
  optionHint?: (value: string) => string | undefined;
  /** Extra words that find an option when typing (a meaning, a reading). */
  optionSearch?: (value: string) => string | undefined;
  /** Headings: the options are listed under these labels, in this order (`options` stays the full set). */
  groups?: SelectGroup[];
  placeholder?: string;
  disabled?: boolean;
  /** Single mode: offer a way back to "nothing chosen". */
  clearable?: boolean;
  searchable?: boolean;
  /** A colour dot before an option and its chip (tags). */
  optionColor?: (value: string) => string | undefined;
  /** Offer to create what was typed when it matches nothing exactly (tags, sources): the caller opens its own form. */
  onCreate?: (typed: string) => void;
  createLabel?: (typed: string) => string;
  loading?: boolean;
  /** Classes for the shown values (options, chips, the chosen value): a bigger serif for glyphs. */
  valueClassName?: string;
  /** The wrapper's classes: the width. */
  className?: string;
  /** Set for text in another script, so the browser picks the right font. */
  lang?: string;
}) {
  const t = useTranslations("ui");
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const id = `${uid}-input`;
  const listId = `${uid}-list`;
  const canType = searchable ?? (options.length > 7 || !!onCreate);
  const typed = searchInput.trim();
  const canCreate = !!onCreate && !disabled && typed !== "" && !options.some((o) => formatLabel(o).trim().toLowerCase() === typed.toLowerCase());

  const selectedArray: string[] = multiple ? (Array.isArray(selectedOption) ? selectedOption : selectedOption ? [selectedOption] : []) : [];
  const singleValue = !multiple ? (Array.isArray(selectedOption) ? (selectedOption[0] ?? "") : selectedOption) : "";

  const formatLabel = (value: string) =>
    optionLabel?.(value) ?? (value === "" ? "—" : value.replace(/[-_]/g, " ").replace(/^./, (m) => m.toUpperCase()));

  // What is listed now, in display order (grouped or flat): the keyboard walks this list.
  const visible = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    const matches = (opt: string) =>
      (multiple ? !selectedArray.includes(opt) : true) &&
      (!q || [formatLabel(opt), optionHint?.(opt), optionSearch?.(opt), opt].some((s) => s?.toLowerCase().includes(q)));
    const flat = options.filter(matches);
    const sections = groups
      ? groups.map((g) => ({ label: g.label, options: g.options.filter((o) => flat.includes(o)) })).filter((g) => g.options.length > 0)
      : [{ label: "", options: flat }];
    return { flat: sections.flatMap((s) => s.options), sections };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, groups, searchInput, multiple, selectedOption, optionLabel, optionHint, optionSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchInput("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { setActive(0); }, [searchInput, isOpen]);
  useEffect(() => {
    if (isOpen) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, isOpen]);

  const choose = (option: string) => {
    if (!multiple) {
      onChange(option);
      setSearchInput("");
      setIsOpen(false);
      return;
    }
    onChange(selectedArray.includes(option) ? selectedArray.filter((o) => o !== option) : [...selectedArray, option]);
    setSearchInput("");
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const last = visible.flat.length - 1;
    if (e.key === "ArrowDown") { e.preventDefault(); if (!isOpen) setIsOpen(true); else setActive((a) => Math.min(last, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (!isOpen) setIsOpen(true); else setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home" && isOpen) { e.preventDefault(); setActive(0); }
    else if (e.key === "End" && isOpen) { e.preventDefault(); setActive(Math.max(0, last)); }
    else if (e.key === "Enter") {
      if (isOpen) { e.preventDefault(); const opt = visible.flat[active]; if (opt !== undefined) choose(opt); else if (canCreate) { setIsOpen(false); setSearchInput(""); onCreate!(typed); } }     // never submits the form while the list is open
    }
    else if (e.key === "Escape" && isOpen) { e.preventDefault(); e.stopPropagation(); setIsOpen(false); setSearchInput(""); }
    else if (e.key === "Backspace" && multiple && searchInput === "" && selectedArray.length) onChange(selectedArray.slice(0, -1));
    else if (e.key === "Tab") { setIsOpen(false); setSearchInput(""); }
  };

  let index = -1;
  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 ${className}`} lang={lang}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}

      {/* Trigger box */}
      <div
        onClick={() => { if (!disabled) { setIsOpen(true); inputRef.current?.focus(); } }}
        className={`
          relative flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5
          bg-surface border-border transition-colors ${disabled ? "opacity-50" : "cursor-pointer"}
          focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft
          ${isOpen ? "border-accent ring-2 ring-accent-soft" : ""}
        `}
      >
        {multiple && selectedArray.map((opt) => (
          <span key={opt} className={`chip ${valueClassName}`}>
            {optionColor?.(opt) && <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: optionColor(opt) }} aria-hidden="true" />}
            {chipLabel?.(opt) ?? formatLabel(opt)}
            <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onChange(selectedArray.filter((o) => o !== opt)); }}
              className="chip-remove text-accent" aria-label={t("removeOption", { option: chipLabel?.(opt) ?? formatLabel(opt) })}>
              <FontAwesomeIcon icon={faTimes} className="text-[10px]" aria-hidden="true" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete={canType ? "list" : "none"}
          aria-activedescendant={isOpen && visible.flat.length ? `${uid}-opt-${active}` : undefined}
          aria-label={label ? undefined : ariaLabel}
          aria-required={required || undefined}
          autoComplete="off"
          disabled={disabled || loading}
          readOnly={!canType}
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={loading ? t("loading") : multiple ? (selectedArray.length === 0 ? (placeholder ?? t("searchOrSelect")) : "") : singleValue !== "" || (singleValue === "" && options.includes("") && !placeholder) ? "" : (placeholder ?? t("searchOrSelect"))}
          className="min-w-[80px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
        />

        {/* Single mode: the chosen value, shown while not typing */}
        {!multiple && (singleValue !== "" || options.includes("")) && !searchInput && !(singleValue === "" && placeholder) && (
          <span className={`pointer-events-none absolute left-2 text-sm text-foreground ${valueClassName}`}>{formatLabel(singleValue)}</span>
        )}

        {clearable && !multiple && singleValue !== "" && !disabled && (
          <button type="button" aria-label={t("clearSelection")} className="chip-remove ml-auto text-muted" onClick={(e) => { e.stopPropagation(); onChange(""); }}>
            <FontAwesomeIcon icon={faTimes} className="text-[10px]" aria-hidden="true" />
          </button>
        )}
        <FontAwesomeIcon icon={faChevronDown} aria-hidden="true"
          className={`${clearable && singleValue !== "" ? "" : "ml-auto"} flex-shrink-0 text-muted text-xs transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div ref={listRef} id={listId} role="listbox" aria-multiselectable={multiple} aria-label={label ?? ariaLabel}
          className="card absolute left-0 right-0 top-full z-[70] mt-1 max-h-72 min-w-48 overflow-y-auto p-0 shadow-md">
          {visible.flat.length === 0 && !canCreate ? (
            <EmptyState className="px-3 py-2 text-sm">{t("noMatchingOptions")}</EmptyState>
          ) : (
            visible.sections.map((section) => (
              <div key={section.label} role={groups ? "group" : undefined} aria-label={groups ? section.label : undefined}>
                {groups && <p aria-hidden="true" className="sticky top-0 bg-surface px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">{section.label}</p>}
                {section.options.map((option) => {
                  index += 1;
                  const i = index;
                  const isSelected = !multiple && singleValue === option;
                  const hint = optionHint?.(option);
                  return (
                    <button
                      key={option === "" ? "__empty" : option}
                      id={`${uid}-opt-${i}`}
                      data-index={i}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={isSelected}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(option)}
                      className={`
                        flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors
                        ${isSelected ? "text-accent font-medium" : "text-foreground"} ${i === active ? "bg-accent-soft" : ""}
                      `}
                    >
                      <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          {optionColor?.(option) && <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: optionColor(option) }} aria-hidden="true" />}
                          <span className={valueClassName}>{formatLabel(option)}</span>
                        </span>
                        {hint && <span className="truncate text-xs font-normal text-muted">{hint}</span>}
                      </span>
                      {isSelected && <span className="h-2 w-2 rounded-full bg-accent flex-shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          {canCreate && (
            <button type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setIsOpen(false); setSearchInput(""); onCreate!(typed); }}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-accent hover:bg-accent-soft">
              + {createLabel?.(typed) ?? t("createTyped", { typed })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
