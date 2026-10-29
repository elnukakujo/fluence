"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Shared accessible modal: portal, Escape / backdrop-click to close, focus moved in and restored.
export default function Modal({ title, subtitle, onClose, children, footer }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // callers pass inline lambdas; don't re-run the focus effect on every render

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card w-full max-w-lg max-h-[85vh] flex flex-col gap-4 outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h3 id={titleId} className="font-serif text-lg">{title}</h3>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="btn btn-secondary !p-2 !min-h-0 shrink-0">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto min-h-0">{children}</div>
        {footer && <div className="flex flex-row gap-2 justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
