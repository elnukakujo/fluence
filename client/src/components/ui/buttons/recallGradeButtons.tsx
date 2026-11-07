import { useTranslations } from "next-intl";

export type RecallGrade = "again" | "hard" | "good" | "easy";

type GradeOption = {
    value: RecallGrade;
    labelKey: string;
    hintKey: string;
    score: number;
};

const GRADES_CONFIG: GradeOption[] = [
    { value: "again", labelKey: "again", hintKey: "blank",     score: 0 },
    { value: "hard",  labelKey: "hard",  hintKey: "struggled", score: 0.5 },
    { value: "good",  labelKey: "good",  hintKey: "recalled",  score: 0.75 },
    { value: "easy",  labelKey: "easy",  hintKey: "instant",   score: 1 },
];

type RecallGradeButtonsProps = {
    onGrade: (score: number) => void;
    /** The grade that matches how the card went; marked with text. The user still chooses. */
    suggested?: RecallGrade;
};

export default function RecallGradeButtons({ onGrade, suggested }: RecallGradeButtonsProps) {
    const t = useTranslations("ui");

    const GRADES = GRADES_CONFIG.map(g => ({
        ...g,
        label: t(g.labelKey),
        hint: t(g.hintKey),
    }));

    return (
        <section className="flex flex-col gap-2">
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                {t("howWellRemember")}
            </p>
            <div className="btn-row flex-wrap">
                {GRADES.map(({ value, label, hint, score }) => (
                    <button
                        key={value}
                        onClick={() => onGrade(score)}
                        className={`grade-btn grade-${value}`}
                    >
                        <span className="grade-dot" />
                        <span className="grade-label">{label}</span>
                        <span className="grade-hint">{hint}</span>
                        {suggested === value && <span className="badge">{t("suggested")}</span>}
                    </button>
                ))}
            </div>
        </section>
    );
}