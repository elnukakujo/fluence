import { useTranslations } from "next-intl";
import Grammar from "@/interface/features/Grammar";
import ElementMediaCard from "./elementMediaCard";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function GrammarCard({ grammar }: { grammar: Grammar | Partial<Grammar> }) {
    const t = useTranslations("elements");
    return (
        <section className="card flex flex-col space-y-4">
            <h3>{t("grammarInfo")}</h3>
            <div className="index-divider pt-3 flex flex-col space-y-4">
                <h4>{grammar.title}</h4>
                {grammar.explanation && <Markdown remarkPlugins={[remarkGfm]}>{grammar.explanation}</Markdown>}
                {(grammar.image_files && grammar.image_files.length > 0) || (grammar.audio_files && grammar.audio_files.length > 0) ? (
                    <ElementMediaCard element={grammar} />
                ) : null}
            </div>
        </section>
    );
}