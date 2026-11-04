"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Element = {
    id: string;
    value: string;
};

export default function OpenCloseMenu({
    elements,
    selectedElements,
    setSelectedElements,
    label
} : {
    elements: Element[],
    selectedElements: string[],
    setSelectedElements: (elements: string[]) => void,
    label?: string
}) {

    const [isOpen, setIsOpen] = useState(false);
    const t = useTranslations("ui");

    return (
        <menu className="list-none pl-0">
            {label && <label className="block text-sm font-medium text-foreground">
                {label}
            </label>}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="btn btn-secondary"
            >
                {isOpen ? t("hide") : t("show")}
            </button>
            {isOpen && (
                <ul className="max-w-[40rem] flex flex-row flex-wrap gap-2 mt-2 list-none pl-0">
                    {elements.map((item) => (
                        <li key={item.id}>
                        <button
                            type="button"
                            onClick={() => {
                            setSelectedElements(
                                selectedElements.includes(item.id) ?
                                selectedElements.filter(id => id !== item.id) :
                                [...selectedElements, item.id]
                            );
                            }}
                            className={
                            selectedElements.includes(item.id) ? "btn btn-primary" : "btn btn-secondary"
                            }
                        >
                            {item.value}
                        </button>
                        
                        </li>
                    ))}
                </ul>
            )}
        </menu>
    );
}