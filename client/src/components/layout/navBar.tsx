"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BackButton from "@/components/ui/buttons/backButton";
import SearchBar from "@/components/layout/searchBar";
import { logout } from "@/api/user";

const primaryLinks = [
	{ href: "/", label: "Home" },
	{ href: "/sources", label: "Sources" },
	{ href: "/tags", label: "Tags" },
];

export default function NavBar({ currentUserId }: { currentUserId: string | null }) {
	const pathname = usePathname();
	const router = useRouter();

	const isActive = (href: string) => {
		if (href === "/") {
			return pathname === "/" || pathname.startsWith("/languages");
		}

		return pathname === href || pathname.startsWith(`${href}/`);
	};

	return (
		<header className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur-md">
			<div className="nav-row mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
				<div className="flex items-center gap-3">
					<div className={pathname === "/" || /^\/user\/[^/]+\/update$/.test(pathname) ? "invisible pointer-events-none max-sm:hidden" : "visible"}>
						<BackButton />
					</div>
					<Link href="/" className="flex items-center gap-1" aria-label="Fluence">
						<img src="/fluence-mark.svg" alt="" aria-hidden="true" className="-my-3 h-14 w-14 shrink-0" />
						<span className="font-serif text-2xl font-semibold tracking-tight text-foreground">Fluence</span>
					</Link>
				</div>

				<nav className="nav-links flex items-center gap-1">
					{primaryLinks.map((link) => {
						const active = isActive(link.href);

						return (
							<Link
								key={link.href}
								href={link.href}
								aria-current={active ? "page" : undefined}
								className={`relative whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-medium transition-colors ${
									active
										? "text-accent"
										: "text-muted hover:bg-accent-soft hover:text-foreground"
								}`}
							>
								{link.label}
								{active && (
									<span
										aria-hidden
										className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent"
									/>
								)}
							</Link>
						);
					})}
				</nav>
				<div className="nav-search">
					<SearchBar currentUserId={currentUserId} />
				</div>
                <div className={`nav-user flex items-center gap-2 ${currentUserId ? "visible" : "invisible pointer-events-none"}`}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={async () => {
                            await logout();
                            router.push('/');
                            router.refresh();
                        }}
                    >
                        Log out
                    </button>
                    <Link
                        href={`/user/${currentUserId}/update`}
                        className="btn btn-primary shrink-0"
                    >
                        Settings
                    </Link>
                </div>
			</div>
		</header>
	);
}
