"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getUserById } from "@/api/user";
import { LOCALES, LOCALE_COOKIE, suggestedLocales, type Locale } from "@/i18n/locales";

const NAMES: Record<Locale, string> = { en: "English", fr: "Français", zh: "中文" };

export default function LocaleSwitcher({ currentUserId }: { currentUserId: string | null }) {
	const router = useRouter();
	const locale = useLocale();
	const t = useTranslations("locale");
	const [natives, setNatives] = useState<string[]>([]);

	useEffect(() => {
		if (!currentUserId) return setNatives([]);
		getUserById(currentUserId)
			.then((u) => setNatives(u?.preferences?.native_language_iso639_2 ?? []))
			.catch(() => setNatives([]));
	}, [currentUserId]);

	const suggested = suggestedLocales(natives);
	const ordered = [...suggested, ...LOCALES.filter((l) => !suggested.includes(l))];

	return (
		<select
			aria-label={t("label")}
			value={locale}
			onChange={(e) => {
				document.cookie = `${LOCALE_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
				router.refresh();
			}}
			className="btn btn-secondary max-w-[9rem] shrink-0 cursor-pointer truncate px-2 text-sm"
		>
			{ordered.map((l) => (
				<option key={l} value={l}>
					{NAMES[l]}
					{suggested.includes(l) ? ` · ${t("suggested")}` : ""}
				</option>
			))}
		</select>
	);
}
