import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/** The flip-card chrome shared by vocabulary, grammar and calligraphy: a front the learner clicks to reveal, and a back. */
export default function FlipCard({ hidden, onReveal, front, back }: { hidden: boolean; onReveal(): void; front: ReactNode; back: ReactNode }) {
    const t = useTranslations("elements");
    return (
        <div className="flashcard">
            <div className={`flashcard-inner ${!hidden ? "is-flipped" : ""}`}>
                <div
                    className="flashcard-face card cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={onReveal}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onReveal();
                        }
                    }}
                >
                    {front}
                    <p className="text-sm text-muted text-center mt-3">{t("clickToReveal")}</p>
                </div>
                <div className="flashcard-face flashcard-face-back card">{back}</div>
            </div>
        </div>
    );
}
