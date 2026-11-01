"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, Settings, UserRound } from "lucide-react";
import { logout } from "@/api/user";

export default function AccountMenu({ userId }: { userId: string }) {
	const t = useTranslations("navBar");
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
		const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
		document.addEventListener("mousedown", away);
		document.addEventListener("keydown", esc);
		return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
	}, [open]);

	const item = "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:outline-none";

	return (
		<div ref={root} className="relative shrink-0">
			<button
				type="button"
				aria-label={t("account")}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className="btn btn-secondary size-11 !p-0"
			>
				<UserRound aria-hidden size={18} />
			</button>
			{open && (
				<div role="menu" className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
					<Link role="menuitem" href={`/user/${userId}/update`} className={item} onClick={() => setOpen(false)}>
						<Settings aria-hidden size={16} />
						{t("settings")}
					</Link>
					<button
						role="menuitem"
						type="button"
						className={`${item} text-left`}
						onClick={async () => {
							setOpen(false);
							await logout();
							router.push("/");
							router.refresh();
						}}
					>
						<LogOut aria-hidden size={16} />
						{t("logout")}
					</button>
				</div>
			)}
		</div>
	);
}
