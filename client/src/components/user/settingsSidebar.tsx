"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export default function SettingsSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const t = useTranslations("settings");
  const tAdmin = useTranslations("settingsAdmin");
  const [active, setActive] = useState<string>("profile");
  const listRef = useRef<HTMLUListElement>(null);

  const COMMON_SECTIONS = [
    { id: "profile", label: t("sidebar.profile") },
    { id: "learning", label: t("sidebar.learning") },
    { id: "ai", label: t("sidebar.ai") },
    { id: "study", label: t("sidebar.study") },
  ];

  const ADMIN_SECTIONS = [{ id: "admin", label: tAdmin("sidebar.admin") }];

  const sections = isAdmin ? [...COMMON_SECTIONS, ...ADMIN_SECTIONS] : COMMON_SECTIONS;

  useEffect(() => {
    const handle = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) handle.observe(el);
    }

    return () => handle.disconnect();
  }, [isAdmin]);

  // Keep the active chip visible in the horizontal strip (phones).
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    const list = listRef.current;
    if (!el || !list || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="settings-sidebar" aria-label={t("sectionsAriaLabel")}>
      <ul ref={listRef} className="settings-chips">
        {sections.map((s) => (
          <li key={s.id} className="shrink-0 md:shrink">
            <button
              type="button"
              onClick={() => scrollTo(s.id)}
              className={`settings-sidebar-link ${active === s.id ? "active" : ""}`}
              aria-current={active === s.id ? "true" : undefined}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
