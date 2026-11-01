import { useTranslations } from "next-intl";
import { BaseElement } from "@/interface/base";
import NavButton from "@/components/layout/navButton";

export default function ElementSourcesCard({element} : {element: BaseElement}) {
    const t = useTranslations("elements");
    return (
        <section className="card">
            <h2 className="text-lg font-semibold mb-1">{t("sourcesHeading")}</h2>
            {element.sources && element.sources.length > 0 ? (
                <div className="index-divider pt-3 flex flex-wrap gap-2">
                    {element.sources.map((source) => (
                        <NavButton
                            key={source.id}
                            className="badge cursor-pointer transition-colors hover:bg-accent hover:text-primary-foreground"
                            path={`/sources/${source.id}`}
                        >
                            {source.title}
                        </NavButton>
                    ))}
                </div>
            ) : (
                <p className="index-divider pt-3 text-muted">{t("noSourcesAssigned")}</p>
            )}
        </section>
    );
}