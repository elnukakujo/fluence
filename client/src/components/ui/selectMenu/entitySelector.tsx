"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useTranslations } from "next-intl";
import ClassicSelectMenu from "./classicSelectMenu";

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
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState("");
  // Track which entity IDs are currently mid-request to show a loading state on them
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
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

  const trimmedInput = searchInput.trim();

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

  const byId = useMemo(() => new Map(allEntities.map((e) => [e.id, e])), [allEntities]);
  // The one shared dropdown does the picking; this component only adds the server calls around it.
  const onPick = (next: string | string[]) => {
    const ids = next as string[];
    const added = ids.find((id) => !selectedIds.includes(id));
    const removed = selectedIds.find((id) => !ids.includes(id));
    if (added && byId.get(added)) handleSelect(byId.get(added)!);
    else if (removed && byId.get(removed)) handleRemove(byId.get(removed)!);
  };

  return (
    <>
      <section className="flex w-full flex-col gap-1.5">
        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <ClassicSelectMenu
          multiple
          label={label.charAt(0).toUpperCase() + label.slice(1)}
          className="w-full"
          options={allEntities.map((e) => e.id)}
          selectedOption={selectedIds.filter((id) => byId.has(id))}
          onChange={onPick}
          optionLabel={(id) => byId.get(id) ? getLabel(byId.get(id)!) : id}
          optionColor={(id) => (byId.get(id) ? getColor?.(byId.get(id)!) : undefined)}
          placeholder={`${t("searchOrAdd", { what: label.toLowerCase() })}`}
          disabled={disabled}
          loading={isLoading}
          onCreate={(typed) => { setSearchInput(typed); setShowCreateModal(true); }}
          createLabel={(typed) => t("createTyped", { typed })}
        />
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
