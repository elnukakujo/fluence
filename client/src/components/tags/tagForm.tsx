"use client";
import { useState, useRef, useEffect } from "react";
import SubmitButton from "@/components/ui/buttons/submitButton";
import { useRouter } from "next/navigation";
import { HexColorPicker, HexColorInput } from "react-colorful";
import Tag from '@/interface/systemData/Tag';
import { createTag, updateTag } from "@/api/tag";
import AutoWidthInput from "@/components/ui/input/autoWidthInput";
import AutoSizeTextArea from "@/components/ui/textArea/autoSizeTextArea";
import { getCurrentUserId } from "@/utils/user_cookie";
import { useTranslations } from "next-intl";

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
];

export default function TagForm({ tag, navDisabled = false, onSuccess }: { tag?: Tag | Partial<Tag>, navDisabled?: boolean, onSuccess?: () => void }) {
  const isUpdate = Boolean(tag?.id);
  const router = useRouter();
  const t = useTranslations("tags");

  const tagData: Partial<Tag> = tag ?? {
    id: "", user_id: "", name: "", color: "", description: ""
  };

  const [userId, setUserId] = useState<string>("");
  const [name, setName] = useState<string>(tagData.name || "");
  const [color, setColor] = useState<string>(tagData.color || "#3B82F6");
  const [description, setDescription] = useState<string>(tagData.description || "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUserId = async () => {
      const currentUserId = await getCurrentUserId();
      setUserId(currentUserId!);
    };
    fetchUserId();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const element: Partial<Tag> = {
      id: tagData.id,
      user_id: userId,
      name,
      color,
      description,
    };
    setIsSubmitting(true);
    try {
      if (isUpdate) {
        await updateTag(tagData.id!, element);
      } else {
        await createTag(element);
      }
      if (!navDisabled) {
        router.push(`/tags`);
        router.refresh();
      }
    } catch (error) {
      console.error("Error creating/updating tag:", error);
      alert(t(isUpdate ? "updateTagFailed" : "createTagFailed"));
    } finally {
      setIsSubmitting(false);
      if (onSuccess) onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 items-center">
      <AutoWidthInput
        label={t("name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("tagNamePlaceholder")}
        required
      />

      {/* Color picker */}
      <div className="flex flex-col gap-2 items-center">
        <label className="text-sm font-medium">{t("color")}</label>

        {/* Swatch trigger */}
        <div
          className="w-8 h-8 rounded-full border-2 border-border cursor-pointer"
          style={{ backgroundColor: color }}
          onClick={() => setPickerOpen((v) => !v)}
        />

        {pickerOpen && (
          <div ref={pickerRef} className="card flex flex-col gap-3 shadow-lg z-10">
            <HexColorPicker color={color} onChange={setColor} />

            {/* Preset swatches */}
            <div className="flex gap-2 flex-wrap justify-center">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: preset,
                    borderColor: color === preset ? "var(--color-foreground)" : "transparent",
                  }}
                  onClick={() => setColor(preset)}
                />
              ))}
            </div>

            {/* Hex input */}
            <HexColorInput
              color={color}
              onChange={setColor}
              prefixed
              className="input text-center"
            />
          </div>
        )}
      </div>

      <AutoSizeTextArea
        label={t("description")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {isUpdate ? <SubmitButton isLoading={isSubmitting}>{t("updateTag")}</SubmitButton> : <SubmitButton isLoading={isSubmitting}>{t("addTag")}</SubmitButton>}
    </form>
  );
}