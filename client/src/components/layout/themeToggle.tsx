"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { setThemeCookie } from "@/components/user/theme";

const query = () => window.matchMedia("(prefers-color-scheme: dark)");

/** Sun or moon for the theme in use. No choice stored = follow the system; a click picks the opposite, and picking the
 *  system's own theme goes back to following it. The choice is a cookie, so it survives every reload and session. */
export default function ThemeToggle() {
	const t = useTranslations("navBar");
	const [dark, setDark] = useState(false);

	useEffect(() => {
		const read = () => {
			const chosen = document.documentElement.dataset.theme;
			setDark(chosen ? chosen === "dark" : query().matches);
		};
		read();
		const mq = query();
		mq.addEventListener("change", read);
		return () => mq.removeEventListener("change", read);
	}, []);

	const toggle = () => {
		const next = dark ? "light" : "dark";
		setThemeCookie(next === (query().matches ? "dark" : "light") ? "system" : next);
		setDark(!dark);
	};

	return (
		<button type="button" className="btn btn-secondary size-11 shrink-0 !p-0" onClick={toggle} aria-label={dark ? t("lightTheme") : t("darkTheme")}>
			{dark ? <Sun aria-hidden size={18} /> : <Moon aria-hidden size={18} />}
		</button>
	);
}
