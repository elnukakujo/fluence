"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";

interface EntityLike {
  id: string;
}

interface EntitySelectorProps<T extends EntityLike> {
  label: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  elementId: string;
  disabled?: boolean;
  fetchAll: () => Promise<T[] | { [key: string]: T[] | undefined }>;
  addToElement: (entityId: string, elementId: string) => Promise<unknown>;
  removeFromElement: (entityId: string, elementId: string) => Promise<unknown>;
  getLabel: (entity: T) => string;
  getColor?: (entity: T) => string | undefined;
  renderCreateForm: (searchInput: string, onSuccess: () => void) => React.ReactNode;
}

function normalizeEntities<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const values = Object.values(payload as Record<string, unknown>);
    const found = values.find((v) => Array.isArray(v));
    if (Array.isArray(found)) return found as T[];
  }
  return [];
}

export default function EntitySelector<T extends EntityLike>({
  label,
  selectedIds,
  onSelectionChange,
  elementId,
  disabled = false,
  fetchAll,
  addToElement,
  removeFromElement,
  getLabel,
  getColor,
  renderCreateForm,
}: EntitySelectorProps<T>) {
  const [allEntities, setAllEntities] = useState<T[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState("");
  // Track which entity IDs are currently mid-request to show a loading state on them
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("ui");

  const fetchEntities = async () => {
    setIsLoading(true);
    try {
      const response = await fetchAll();
      setAllEntities(normalizeEntities<T>(response));
    } catch (err) {
      console.error(`Failed to fetch ${label.toLowerCase()}:`, err);
      setError(`Failed to load ${label.toLowerCase()}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedEntities = useMemo(
    () => allEntities.filter((entity) => selectedIds.includes(entity.id)),
    [allEntities, selectedIds]
  );

  const trimmedInput = searchInput.trim();

  const filteredEntities = useMemo(() => {
    const query = trimmedInput.toLowerCase();
    return allEntities.filter(
      (entity) =>
        !selectedIds.includes(entity.id) &&
        (!query || getLabel(entity).toLowerCase().includes(query))
    );
  }, [allEntities, trimmedInput, selectedIds, getLabel]);

  const canCreate = useMemo(() => {
    if (!trimmedInput || disabled) return false;
    return !allEntities.some(
      (entity) => getLabel(entity).trim().toLowerCase() === trimmedInput.toLowerCase()
    );
  }, [allEntities, disabled, trimmedInput, getLabel]);

  const setPending = (entityId: string, pending: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(entityId); else next.delete(entityId);
      return next;
    });
  };

  const handleSelect = async (entity: T) => {
    if (selectedIds.includes(entity.id) || pendingIds.has(entity.id)) return;

    // Optimistic update
    onSelectionChange([...selectedIds, entity.id]);
    setSearchInput("");
    setIsOpen(false);
    inputRef.current?.focus();

    if (!elementId) return; // If it is part of a create form the add logic will be handled in the form submission

    setPending(entity.id, true);
    try {
      await addToElement(entity.id, elementId);
    } catch (err) {
      console.error(`Failed to add "${getLabel(entity)}":`, err);
      setError(`Failed to add "${getLabel(entity)}"`);
      // Roll back
      onSelectionChange(selectedIds.filter((id) => id !== entity.id));
    } finally {
      setPending(entity.id, false);
    }
  };

  const handleRemove = async (entity: T) => {
    if (pendingIds.has(entity.id)) return;

    // Optimistic update
    onSelectionChange(selectedIds.filter((id) => id !== entity.id));

    if (!elementId) return; // If it is part of a create form the remove logic will be handled in the form submission

    setPending(entity.id, true);
    try {
      await removeFromElement(entity.id, elementId);
    } catch (err) {
      console.error(`Failed to remove "${getLabel(entity)}":`, err);
      setError(`Failed to remove "${getLabel(entity)}"`);
      // Roll back
      onSelectionChange([...selectedIds, entity.id]);
    } finally {
      setPending(entity.id, false);
    }
  };

  const handleCloseCreateModal = async () => {
    setShowCreateModal(false);
    await fetchEntities();
  };

  return (
    <>
      <section ref={containerRef} className="flex w-full max-w-md flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </label>

        {error && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="relative">
          <div
            className={`flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors
              ${disabled ? "bg-background border-border" : "bg-surface border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft"}`}
            onClick={() => { if (!disabled) { setIsOpen(true); inputRef.current?.focus(); } }}
          >
            {selectedEntities.map((entity) => {
              const isPending = pendingIds.has(entity.id);
              const color = getColor?.(entity);
              return (
                <span
                  key={entity.id}
                  className={`chip ${isPending ? "opacity-50" : "opacity-100"}`}
                >
                  {color && (
                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  )}
                  {getLabel(entity)}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemove(entity); }}
                    disabled={disabled || isPending}
                    className="chip-remove"
                    aria-label={`${t("remove")} ${getLabel(entity)}`}
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-[10px]" />
                  </button>
                </span>
              );
            })}

            {isLoading ? (
              <span className="px-1 text-sm text-muted">{t("loading")}</span>
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setIsOpen(true); }}
                onFocus={() => setIsOpen(true)}
                placeholder={selectedEntities.length === 0 ? `Search or add ${label.toLowerCase()}…` : ""}
                disabled={disabled}
                className="min-w-[120px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
              />
            )}
          </div>

          {isOpen && !isLoading && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-surface shadow-md">
              {filteredEntities.length > 0
                ? filteredEntities.map((entity) => (
                    <button
                      key={entity.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(entity)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent-soft"
                    >
                      {getColor?.(entity) && (
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: getColor(entity) }} />
                      )}
                      <span className="text-foreground">{getLabel(entity)}</span>
                    </button>
                  ))
                : !canCreate && (
                    <p className="px-3 py-2 text-sm text-muted">No matching {label.toLowerCase()}</p>
                  )}

              {canCreate && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setIsOpen(false); setShowCreateModal(true); }}
                  className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-accent transition-colors hover:bg-accent-soft"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  <span>Create &ldquo;{trimmedInput}&rdquo;</span>
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {showCreateModal &&
        createPortal(
          <section
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={handleCloseCreateModal}
            onSubmit={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-medium text-foreground">Create {label.toLowerCase().replace(/s$/, "")}</h2>
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="text-muted transition-colors hover:text-foreground"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              {renderCreateForm(trimmedInput, handleCloseCreateModal)}
            </div>
          </section>,
          document.body
        )}
    </>
  );
}
