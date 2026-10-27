"use client";

import { useEffect, useState } from "react";

const COMMON_SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "preferences", label: "Learning" },
  { id: "ai-features", label: "AI Features" },
  { id: "api-endpoints", label: "Endpoints" },
];

const ADMIN_SECTIONS = [
  { id: "users", label: "Users" },
  { id: "backups", label: "Backups" },
  { id: "logs", label: "Logs" },
];

export default function SettingsSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const [active, setActive] = useState<string>("profile");
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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="settings-sidebar" role="navigation" aria-label="Settings sections">
      <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
        {sections.map((s) => (
          <li key={s.id}>
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
