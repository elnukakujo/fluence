"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, Home, Library, Search, Tag, X } from "lucide-react";
import BackButton from "@/components/ui/buttons/backButton";
import SearchBar from "@/components/layout/searchBar";
import AccountMenu from "@/components/layout/accountMenu";
import LocaleSwitcher from "@/components/layout/localeSwitcher";
import ImportsIndicator from "@/components/ingestion/importsIndicator";

const primaryLinks = [
	{ href: "/", key: "home", Icon: Home },
	{ href: "/sources", key: "sources", Icon: Library },
	{ href: "/tags", key: "tags", Icon: Tag },
] as const;

export default function NavBar({ currentUserId }: { currentUserId: string | null }) {
	const t = useTranslations("navBar");
	const pathname = usePathname();
	const [searchOpen, setSearchOpen] = useState(false);

	useEffect(() => setSearchOpen(false), [pathname]);

	const isActive = (href: string) =>
		href === "/" ? pathname === "/" || pathname.startsWith("/languages") : pathname === href || pathname.startsWith(`${href}/`);

	const hideBack = pathname === "/" || /^\/user\/[^/]+\/update$/.test(pathname);

	return (
		<>
			<header className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur-md">
				<div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
					{/* Brand cluster */}
					<div className="flex min-w-0 shrink-0 items-center gap-2">
						{!hideBack && <BackButton ariaLabel={t("back")} />}
						<Link href="/" className="flex items-center gap-1" aria-label="Fluence">
							<img src="/fluence-mark.svg" alt="" aria-hidden="true" className="-my-3 h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
							<span className="font-serif text-2xl font-semibold tracking-tight text-foreground max-sm:hidden">Fluence</span>
						</Link>
					</div>

					{/* Primary links: tablet/desktop inline; phones use the bottom bar */}
					{currentUserId && (
						<nav aria-label={t("mainNav")} className="hidden items-center gap-1 md:flex">
							{primaryLinks.map(({ href, key }) => {
								const active = isActive(href);
								return (
									<Link
										key={href}
										href={href}
										aria-current={active ? "page" : undefined}
										className={`relative whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-medium transition-colors ${
											active ? "text-accent" : "text-muted hover:bg-accent-soft hover:text-foreground"
										}`}
									>
										{t(key)}
										{active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
									</Link>
								);
							})}
						</nav>
					)}

					<div className="flex-1" />

					{/* Search: inline from lg, icon + overlay below */}
					{currentUserId && (
						<>
							<div className="hidden w-64 xl:w-80 lg:block">
								<SearchBar currentUserId={currentUserId} />
							</div>
							<button
								type="button"
								className="btn btn-secondary size-11 shrink-0 !p-0 lg:hidden"
								aria-label={searchOpen ? t("closeSearch") : t("openSearch")}
								aria-expanded={searchOpen}
								onClick={() => setSearchOpen((o) => !o)}
							>
								{searchOpen ? <X aria-hidden size={18} /> : <Search aria-hidden size={18} />}
							</button>
						</>
					)}

					{currentUserId && <ImportsIndicator />}
					<LocaleSwitcher currentUserId={currentUserId} />
					{currentUserId && <AccountMenu userId={currentUserId} />}
				</div>

				{currentUserId && searchOpen && (
					<div
						className="absolute inset-x-0 top-full border-b border-border bg-surface px-3 py-3 shadow-md sm:px-6 lg:hidden"
						onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
					>
						<div className="mx-auto max-w-6xl">
							<SearchBar currentUserId={currentUserId} autoFocus />
						</div>
					</div>
				)}
			</header>

			{/* Phone bottom tab bar */}
			{currentUserId && (
				<nav
					aria-label={t("mainNav")}
					className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-surface/95 backdrop-blur-md md:hidden"
					style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
				>
					{primaryLinks.map(({ href, key, Icon }) => {
						const active = isActive(href);
						return (
							<Link
								key={href}
								href={href}
								aria-current={active ? "page" : undefined}
								className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
									active ? "text-accent" : "text-muted"
								}`}
							>
								<Icon aria-hidden size={20} />
								{t(key)}
							</Link>
						);
					})}
				</nav>
			)}
		</>
	);
}
