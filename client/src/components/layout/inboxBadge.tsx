"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox as InboxIcon } from "lucide-react";
import { getInbox } from "@/api/inbox";

export const INBOX_CHANGED = "inbox:changed";

/** Nav link to the inbox with the number of drafts waiting; nothing when there are none. */
export default function InboxBadge() {
    const t = useTranslations("navBar");
    const [count, setCount] = useState(0);
    useEffect(() => {
        const load = () => getInbox().then((i) => setCount(i.count), () => setCount(0));
        load();
        window.addEventListener(INBOX_CHANGED, load);
        window.addEventListener("focus", load);
        return () => { window.removeEventListener(INBOX_CHANGED, load); window.removeEventListener("focus", load); };
    }, []);
    if (count === 0) return null;
    return (
        <Link href="/inbox" className="btn btn-secondary relative size-11 shrink-0 !p-0" aria-label={t("inboxCount", { count })}>
            <InboxIcon aria-hidden size={18} />
            <span aria-hidden className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accent px-1 text-center text-xs text-white">{count}</span>
        </Link>
    );
}
