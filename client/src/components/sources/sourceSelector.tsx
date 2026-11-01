"use client";

import { getAllUserSources, addSourceToElement, removeSourceFromElement } from "@/api/source";
import SourceForm from "@/components/sources/sourceForm";
import EntitySelector from "@/components/ui/selectMenu/entitySelector";
import type Source from "@/interface/systemData/Source";
import { getCurrentUserId } from "@/utils/user_cookie";

interface SourceSelectorProps {
  selectedSourceIds: string[];
  onSourcesChange: (sourceIds: string[]) => void;
  elementId: string;
  disabled?: boolean;
}

export default function SourceSelector({
  selectedSourceIds,
  onSourcesChange,
  elementId,
  disabled = false,
}: SourceSelectorProps) {
  return (
    <EntitySelector<Source>
      label="sources"
      selectedIds={selectedSourceIds}
      onSelectionChange={onSourcesChange}
      elementId={elementId}
      disabled={disabled}
      fetchAll={async () => getAllUserSources((await getCurrentUserId())!)}
      addToElement={addSourceToElement}
      removeFromElement={removeSourceFromElement}
      getLabel={(source) => source.title}
      renderCreateForm={(searchInput, onSuccess) => (
        <SourceForm source={{ title: searchInput }} navDisabled={true} onSuccess={onSuccess} />
      )}
    />
  );
}
