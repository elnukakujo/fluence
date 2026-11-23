"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FeedbackPanel } from "./evaluatedFrame";

/** The one result bubble of every evaluated exercise (RC-27): a headline, the model's feedback, the reached level, the expected answer once it may be shown, and the
 *  runner's own extra lines as children. Same order and tone everywhere, so no exercise type looks like another app. */
export default function FeedbackNote({ verdict, headline, message, level, reveal, children }: {
    verdict: "correct" | "partial" | "wrong"; headline: string; message?: string | null;
    level?: { label: string; stars?: string } | null; reveal?: { label: string; value: ReactNode } | null; children?: ReactNode;
}) {
    const t = useTranslations("exercises");
    return (
        <div data-testid="feedback-note" data-verdict={verdict}>
            <FeedbackPanel correct={verdict === "correct"}>
                <p className="font-medium">{headline}</p>
                {message && <p><span className="font-medium">{t("feedback")} </span>{message}</p>}
                {level && <p>{t("level")}{level.label}{level.stars ? ` (${level.stars})` : ""}</p>}
                {reveal && <div className="mt-2"><p className="font-medium">{reveal.label}</p><div>{reveal.value}</div></div>}
                {children}
            </FeedbackPanel>
        </div>
    );
}
