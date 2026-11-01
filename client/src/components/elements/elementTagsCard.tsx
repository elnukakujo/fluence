import { useTranslations } from "next-intl";
import { BaseElement } from "@/interface/base";
import NavButton from "@/components/layout/navButton";

export default function ElementTagsCard({element} : {element: BaseElement}) {
    const t = useTranslations("elements");
    return (
        <section className="card">
            <h2 className="text-lg font-semibold mb-1">{t("tagsHeading")}</h2>
            {element.tags && element.tags.length > 0 ? (
                <div className="index-divider pt-3 flex flex-wrap gap-2">
                    {element.tags.map((tag) => (
                        <NavButton
                            key={tag.id}
                            className="badge cursor-pointer transition-colors hover:bg-accent hover:text-primary-foreground"
                            path={`/tags/${tag.id}`}
                        >
                            {tag.color ? (
                                <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: tag.color }}
                                />
                            ) : null}
                            <span>{tag.name}</span>
                        </NavButton>
                    ))}
                </div>
            ) : (
                <p className="index-divider pt-3 text-muted">{t("noTagsAssigned")}</p>
            )}
        </section>
    );
}