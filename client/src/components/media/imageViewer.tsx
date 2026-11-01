"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";

type ImageViewerProps = {
    src: string;
    alt?: string;
    className?: string;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export default function ImageViewer({ src, alt = "", className = "" }: ImageViewerProps) {
    const t = useTranslations("media");
    const [open, setOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const backdropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")            { setOpen(false); setZoom(1); }
            if (e.key === "+" || e.key === "=") setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM));
            if (e.key === "-")                  setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM));
            if (e.key === "0")                  setZoom(1);
        };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [open]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        setZoom(z => Math.min(Math.max(z - e.deltaY * 0.001, MIN_ZOOM), MAX_ZOOM));
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === backdropRef.current) { setOpen(false); setZoom(1); }
    };

    const close  = () => { setOpen(false); setZoom(1); };
    const zoomIn  = () => setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM));
    const zoomOut = () => setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM));

    return (
        <>
            {/* ── Thumbnail ───────────────────────────────────────── */}
            <button
                type="button"
                className={`imageviewer-thumb ${className}`}
                aria-label={t("imageViewerViewFullSize")}
                onClick ={(e) => { e.stopPropagation(); setOpen(true); }}
                onKeyDown={(e) => e.stopPropagation()}
            >
                <img src={src} alt={alt} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
            </button>

            {/* ── Portal ──────────────────────────────────────────── */}
            {open && createPortal(
                <div
                    ref={backdropRef}
                    className="imageviewer-backdrop"
                    onWheel={handleWheel}
                    onClick ={(e) => { e.stopPropagation(); handleBackdropClick(e); }}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <button className="imageviewer-close" onClick={close} aria-label={t("imageViewerClose")}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M1 1l12 12M13 1L1 13" />
                        </svg>
                    </button>

                    <div className="imageviewer-img-wrap">
                        <img
                            src={src}
                            alt={alt}
                            draggable={false}
                            style={{ transform: `scale(${zoom})` }}
                        />
                    </div>

                    <div className="imageviewer-controls">
                        <button
                            className="btn btn-secondary"
                            style={{ padding: "0.25rem 0.625rem", fontSize: "1rem", lineHeight: 1 }}
                            onClick={zoomOut}
                            aria-label={t("imageViewerZoomOut")}
                            disabled={zoom <= MIN_ZOOM}
                        >−</button>
                        <button
                            className="imageviewer-zoom-label"
                            onClick={() => setZoom(1)}
                            title={t("imageViewerResetZoom")}
                        >
                            {Math.round(zoom * 100)}%
                        </button>
                        <button
                            className="btn btn-secondary"
                            style={{ padding: "0.25rem 0.625rem", fontSize: "1rem", lineHeight: 1 }}
                            onClick={zoomIn}
                            aria-label={t("imageViewerZoomIn")}
                            disabled={zoom >= MAX_ZOOM}
                        >+</button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}