"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Globe } from "lucide-react";
import { getUserById } from "@/api/user";
import { LOCALES, LOCALE_COOKIE, suggestedLocales, type Locale } from "@/i18n/locales";

const NAMES: Record<Locale, string> = { en: "English", fr: "Français", zh: "中文" };

export default function LocaleSwitcher({ currentUserId }: { currentUserId: string | null }) {
	const router = useRouter();
	const locale = useLocale();
	const t = useTranslations("locale");
	const [natives, setNatives] = useState<string[]>([]);
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const listId = useId();

	useEffect(() => {
		if (!currentUserId) return setNatives([]);
		getUserById(currentUserId)
			.then((u) => setNatives(u?.preferences?.native_language_iso639_2 ?? []))
			.catch(() => setNatives([]));
	}, [currentUserId]);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [open]);

	const suggested = suggestedLocales(natives);
	const others = LOCALES.filter((l) => !suggested.includes(l));
	const ordered = [...suggested, ...others];
	const groups = suggested.length
		? [
				{ id: "rec", heading: t("recommendedHeading"), items: suggested },
				...(others.length ? [{ id: "oth", heading: t("othersHeading"), items: others }] : []),
			]
		: [{ id: "all", heading: t("allHeading"), items: others }];

	const select = (l: Locale) => {
		document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
		setOpen(false);
		triggerRef.current?.focus();
		router.refresh();
	};

	const focusOption = (delta: number | "first" | "last") => {
		const opts = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
		if (!opts.length) return;
		const cur = opts.indexOf(document.activeElement as HTMLElement);
		const next =
			delta === "first" ? 0 : delta === "last" ? opts.length - 1 : (cur + delta + opts.length) % opts.length;
		opts[next].focus();
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape" && open) {
			e.stopPropagation();
			setOpen(false);
			triggerRef.current?.focus();
		} else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			if (!open) {
				setOpen(true);
				requestAnimationFrame(() => focusOption(e.key === "ArrowDown" ? "first" : "last"));
			} else focusOption(e.key === "ArrowDown" ? 1 : -1);
		} else if (open && e.key === "Home") {
			e.preventDefault();
			focusOption("first");
		} else if (open && e.key === "End") {
			e.preventDefault();
			focusOption("last");
		} else if (e.key === "Tab") setOpen(false);
	};

	return (
		<div ref={rootRef} className="relative shrink-0" onKeyDown={onKeyDown}>
			<button
				ref={triggerRef}
				type="button"
				aria-label={`${t("label")}: ${NAMES[locale as Locale] ?? locale}`}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				onClick={() => setOpen((o) => !o)}
				className="btn btn-secondary min-h-11 gap-1.5 px-2.5 text-sm sm:px-3 font-medium uppercase tracking-wide"
			>
				<Globe aria-hidden size={16} className="max-sm:hidden" />
				{locale}
				<ChevronDown aria-hidden size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{open && (
				<div
					id={listId}
					role="listbox"
					aria-label={t("label")}
					className="absolute right-0 z-50 mt-2 w-60 max-sm:left-1/2 max-sm:right-auto max-sm:-translate-x-1/2 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lg"
				>
					{groups.map((g, gi) => (
						<div key={g.id} role="group" aria-labelledby={`${listId}-${g.id}`} className={gi ? "mt-1 border-t border-border pt-1" : ""}>
							<div id={`${listId}-${g.id}`} className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
								{g.heading}
							</div>
							{g.items.map((l) => {
								const current = l === locale;
								return (
									<button
										key={l}
										type="button"
										role="option"
										aria-selected={current}
										tabIndex={current || (!ordered.includes(locale as Locale) && l === ordered[0]) ? 0 : -1}
										onClick={() => select(l)}
										className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:outline-none ${
											current ? "font-semibold text-accent" : "text-foreground"
										}`}
									>
										<span className="flex-1 truncate">{NAMES[l]}</span>
										<span className="text-xs uppercase text-muted">{l}</span>
										<Check aria-hidden size={16} className={current ? "opacity-100" : "opacity-0"} />
									</button>
								);
							})}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
