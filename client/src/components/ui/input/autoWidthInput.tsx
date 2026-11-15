"use client";

import { useState, useRef, useEffect, useId } from "react";

export default function AutoWidthInput({
  value,
  onChange,
  label,
  className = "",
  minWidth = 12.5,
  maxWidth = 25,
  height = 2.5,
  placeholder = "",
  disabled = false,
  required = false,
  type = "text",
  ...props

}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  className?: string;
  minWidth?: number;
  height?: number;
  maxWidth?: number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  type?: string;
}) {
  const generatedId = useId();
  const id = (props as { id?: string }).id ?? generatedId;   // a label must point at its own input: two rows can share a label text
  const spanRef = useRef<HTMLSpanElement>(null);
  const [resizeWidth, setResizeWidth] = useState<number>(minWidth);

  // Helper function to convert pixels to rem for state
  const pxToRem = (px: number) => px / parseFloat(getComputedStyle(document.documentElement).fontSize);

  useEffect(() => {
    if (spanRef.current) {
      const newWidth = pxToRem(spanRef.current.offsetWidth);
      if (newWidth < minWidth) {
        setResizeWidth(minWidth);
      } else if (maxWidth) {
        setResizeWidth(newWidth > maxWidth ? maxWidth : newWidth);
      } else {
        setResizeWidth(newWidth);
      }
    }
  }, [value, minWidth, maxWidth]);

  return (
    <span className="flex flex-col space-y-2">
      {label && 
        <label 
          htmlFor={id}
          className="text-sm font-medium text-foreground"
        >
          {label} {required && "*"}
        </label>
      }
      <span
      ref={spanRef}
      className="absolute invisible whitespace-pre text-base px-0"
      >
      {value || " "} {/* space so it’s never zero width */}
      </span>

      <input
        {...props}
        id={id}
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e)}
        style={{ width: `${resizeWidth+1}rem`, height: `${height}rem` }}
        className={`input ${className}`}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
      />
    </span>
  );
}