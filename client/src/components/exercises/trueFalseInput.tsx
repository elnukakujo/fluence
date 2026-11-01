"use client";

import { useTranslations } from "next-intl";

export default function TrueFalseInput({
  value,
  onChange,
  label,
  className = "",
  ...props
}: {
  value: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  className?: string;
}) {
  const t = useTranslations("exercises");
  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      <label className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-center space-x-4">
        <label className="inline-flex items-center">
          <input
            type="radio"
            value="true"
            checked={value === true}
            onChange={(e) => onChange(e as React.ChangeEvent<HTMLInputElement>)}
            className="h-4 w-4 text-accent border-border rounded focus:ring-accent"
            {...props}
          />
          <span className="ml-2">{t("true")}</span>
        </label>
        <label className="inline-flex items-center">
          <input
            type="radio"
            value="false"
            checked={value === false}
            onChange={(e) => onChange(e as React.ChangeEvent<HTMLInputElement>)}
            className="h-4 w-4 text-accent border-border rounded focus:ring-accent"
            {...props}
          />
          <span className="ml-2">{t("false")}</span>
        </label>
      </div>
    </div>
  );
}