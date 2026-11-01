"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";

function NoMatchingOptions() {
  const t = useTranslations("ui");
  return <p className="px-3 py-2 text-sm text-muted">{t("noMatchingOptions")}</p>;
}

export default function ClassicSelectMenu({
  label,
  options,
  selectedOption,
  onChange,
  required = false,
  multiple = false,
  optionLabel,
}: {
  label: string;
  options: string[];
  selectedOption: string | string[];
  onChange: (value: string | string[]) => void;
  required?: boolean;
  multiple?: boolean;
  /** Optional display mapping for fixed enum-like options (value stays untouched). */
  optionLabel?: (value: string) => string | undefined;
}) {
  const t = useTranslations("ui");
  const tUi = useTranslations("ui");
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedArray: string[] = multiple
    ? Array.isArray(selectedOption)
      ? selectedOption
      : selectedOption ? [selectedOption] : []
    : [];

  const singleValue = !multiple
    ? Array.isArray(selectedOption) ? (selectedOption[0] ?? "") : selectedOption
    : "";

  const formatLabel = (value: string) =>
    optionLabel?.(value) ??
    value.replace(/[-_]/g, " ").replace(/^./, (m) => m.toUpperCase());

  const filteredOptions = options.filter((opt) => {
    const matchesSearch = !searchInput || formatLabel(opt).toLowerCase().includes(searchInput.toLowerCase());
    const notSelected = multiple ? !selectedArray.includes(opt) : true;
    return matchesSearch && notSelected;
  });

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

  const handleSelect = (option: string) => {
    if (!multiple) {
      onChange(option);
      setSearchInput("");
      setIsOpen(false);
      return;
    }
    const already = selectedArray.includes(option);
    onChange(already ? selectedArray.filter((o) => o !== option) : [...selectedArray, option]);
    setSearchInput("");
    inputRef.current?.focus();
  };

  const handleRemove = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedArray.filter((o) => o !== option));
  };

  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5 w-full max-w-64">
      {label && (
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-muted">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}

      {/* Trigger box */}
      <div
        onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
        className={`
          relative flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5
          bg-surface border-border cursor-text transition-colors
          focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft
          ${isOpen ? "border-accent ring-2 ring-accent-soft" : ""}
        `}
      >
        {/* Multiple: chips */}
        {multiple && selectedArray.map((opt) => (
          <span
            key={opt}
            className="chip"
          >
            {formatLabel(opt)}
            <button
              type="button"
              onClick={(e) => handleRemove(opt, e)}
              className="chip-remove text-accent"
              aria-label={tUi("removeOption", { option: formatLabel(opt) })}
            >
              <FontAwesomeIcon icon={faTimes} className="text-[10px]" />
            </button>
          </span>
        ))}

        {/* Search input */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={
            multiple
              ? selectedArray.length === 0 ? t("searchOrSelect") : ""
              : singleValue ? "" : t("searchOrSelect")
          }
          className="min-w-[80px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
        />

        {/* Single mode: show selected value as faded overlay when not searching */}
        {!multiple && singleValue && !searchInput && (
          <span className="pointer-events-none absolute left-2 text-sm text-foreground">
            {formatLabel(singleValue)}
          </span>
        )}

        <FontAwesomeIcon
          icon={faChevronDown}
          className={`ml-auto flex-shrink-0 text-muted text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable={multiple}
          className="card z-50 mt-1 max-h-52 overflow-y-auto p-0 shadow-md"
        >
          {filteredOptions.length === 0 ? (
            <NoMatchingOptions />
          ) : (
            filteredOptions.map((option) => {
              const isSelected = !multiple && singleValue === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(option)}
                  className={`
                    flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors
                    ${isSelected ? "bg-accent-soft text-accent font-medium" : "text-foreground hover:bg-accent-soft"}
                  `}
                >
                  {formatLabel(option)}
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}