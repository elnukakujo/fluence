"use client";

import { Ring } from "ldrs/react";
import "ldrs/react/Ring.css";
import { Loader } from "lucide-react";
import { useTranslations } from "next-intl";

/** The app's one loading indicator. A status with a screen-reader label (so a button that swaps its text for a spinner keeps a name);
 *  the animated ring is replaced by a still icon under `prefers-reduced-motion` (see `.spinner-*` in globals.css). */
export default function Spinner({ size = 16, label, color = "currentColor" }: { size?: number; label?: string; color?: string }) {
    const t = useTranslations("ui");
    return (
        <span role="status" className="inline-flex items-center justify-center">
            <span className="spinner-motion inline-flex" aria-hidden="true"><Ring size={size} stroke={2} bgOpacity={0} speed={3} color={color} /></span>
            <span className="spinner-static hidden" aria-hidden="true"><Loader size={size} /></span>
            <span className="sr-only">{label ?? t("loading")}</span>
        </span>
    );
}
