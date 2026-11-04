"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Combine } from "lucide-react";
import { bulkDeleteTags, reorderTags } from "@/api/tag";
import { bulkDeleteSources, reorderSources } from "@/api/source";
import ItemActionBar from "@/components/elements/itemActionBar";
import ManageList from "@/components/elements/manageList";
import { SelectionScope, SelectToggle, useItemSelection } from "@/components/elements/itemSelection";

type Entry = { id: string; label: string; color?: string; description?: string };

// The tags / sources page list: plain links, or (select mode) the shared select-all / drag-and-drop list + action bar with Merge
// (enabled for exactly two) and Delete. No tag / source buttons on the bar (a tag has no tags).
export default function LabelList({ kind, items, empty }: { kind: "tag" | "source"; items: Entry[]; empty: ReactNode }) {
  const t = useTranslations("labels");
  const tEl = useTranslations("elements");
  const router = useRouter();
  const base = kind === "tag" ? "/tags" : "/sources";
  if (items.length === 0) return <>{empty}</>;
  return (
    <SelectionScope canSelect className="flex flex-col gap-2"
      bar={(b) => (
        <ItemActionBar {...b} userId="" links={false} onDelete={kind === "tag" ? bulkDeleteTags : bulkDeleteSources}
          deleteCopy={{ title: t("deleteTitle", { kind, count: b.ids.length }), body: t("deleteBody"), confirm: t("deleteConfirm", { count: b.ids.length }), done: t("deleted", { count: b.ids.length }) }}
          extra={
            <button type="button" className="bulk-action" disabled={b.ids.length !== 2} title={b.ids.length === 2 ? undefined : t("mergeNeedsTwo")}
              onClick={() => router.push(`${base}/merge?a=${b.ids[0]}&b=${b.ids[1]}`)}>
              <Combine size={20} aria-hidden />{tEl("bulkMerge")}
            </button>
          } />
      )}>
      <Rows kind={kind} items={items} base={base} />
    </SelectionScope>
  );
}

function Rows({ kind, items, base }: { kind: "tag" | "source"; items: Entry[]; base: string }) {
  const { isActive } = useItemSelection();
  const k = kind === "tag" ? "tag" : "src";
  return (
    <>
      <div className="flex justify-end"><SelectToggle kind={k} /></div>
      {isActive(k) ? (
        <ManageList kind={k} onReorder={kind === "tag" ? reorderTags : reorderSources}
          items={items.map((it) => ({ id: it.id, title: it.label, owned: true }))} />
      ) : (
        <ul className="card list-none flex flex-col gap-1">
          {items.map((it) => (
            <li key={it.id}>
              <Link href={`${base}/${it.id}`} className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent-soft">
                {kind === "tag" ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: it.color }} /> : <span className="badge shrink-0" />}
                <span className="text-sm">{it.label}</span>
                {it.description && <span className="ml-auto truncate text-xs text-muted">{it.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
