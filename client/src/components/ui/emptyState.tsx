import type { ReactNode } from "react";

/** "There is nothing here": the message, an optional second line and an optional next action.
 *  One colour (`text-muted`, kept above 4.5:1 by the theme token) instead of the per-site opacity variants. */
export default function EmptyState({ children, hint, action, className = "" }: { children: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string }) {
    return (
        <div className={`flex flex-col gap-1 ${className}`.trim()}>
            <p className="text-muted">{children}</p>
            {hint && <p className="text-muted text-sm">{hint}</p>}
            {action}
        </div>
    );
}
