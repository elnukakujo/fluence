import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

/** A short error line. Announced (`role="alert"`), in the semantic danger colour, and never colour alone: an icon goes with the text. */
export default function InlineError({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <p role="alert" className={`text-sm text-danger flex items-start gap-1.5 ${className}`.trim()}>
            <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{children}</span>
        </p>
    );
}
