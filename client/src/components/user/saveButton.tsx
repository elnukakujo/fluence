"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Ring } from "ldrs/react";
import "ldrs/react/Ring.css";
import { Check } from "lucide-react";

export default function SaveButton({
  children,
  isLoading = false,
  onSuccessLabel,
}: {
  children?: React.ReactNode;
  isLoading?: boolean;
  onSuccessLabel?: string;
}) {
  const t = useTranslations("settings.buttons");
  const defaultLabel = children ?? t("save");
  const [showSuccess, setShowSuccess] = useState(false);
  const wasLoading = useRef(false);

  useEffect(() => {
    if (!isLoading && wasLoading.current) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 1500);
      return () => clearTimeout(timer);
    }
    wasLoading.current = isLoading;
  }, [isLoading]);

  if (showSuccess) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--color-success)" }}>
        <Check size={16} aria-hidden="true" />
        {onSuccessLabel ?? t("saveSuccess")}
      </span>
    );
  }

  return (
    <button type="submit" className="btn btn-primary" disabled={isLoading}>
      {isLoading ? <Ring size={16} color="#fff" /> : defaultLabel}
    </button>
  );
}
