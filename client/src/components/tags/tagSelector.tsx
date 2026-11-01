"use client";

import { getAllUserTags, addTagToElement, removeTagFromElement } from "@/api/tag";
import TagForm from "@/components/tags/tagForm";
import EntitySelector from "@/components/ui/selectMenu/entitySelector";
import type Tag from "@/interface/systemData/Tag";
import { getCurrentUserId } from "@/utils/user_cookie";

interface TagSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  elementId: string;
  disabled?: boolean;
}

export default function TagSelector({
  selectedTagIds,
  onTagsChange,
  elementId,
  disabled = false,
}: TagSelectorProps) {
  return (
    <EntitySelector<Tag>
      label="tags"
      selectedIds={selectedTagIds}
      onSelectionChange={onTagsChange}
      elementId={elementId}
      disabled={disabled}
      fetchAll={async () => getAllUserTags((await getCurrentUserId())!)}
      addToElement={addTagToElement}
      removeFromElement={removeTagFromElement}
      getLabel={(tag) => tag.name}
      getColor={(tag) => tag.color}
      renderCreateForm={(searchInput, onSuccess) => (
        <TagForm tag={{ name: searchInput }} navDisabled={true} onSuccess={onSuccess} />
      )}
    />
  );
}
