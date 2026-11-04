"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import Modal from "@/components/ui/dialogs/modal";
import { getAllLessons } from "@/api/lesson";
import { getAllUserTags } from "@/api/tag";
import { getAllUserSources } from "@/api/source";
import { bulkDeleteElements, bulkEditSources, bulkEditTags, bulkMoveElements } from "@/api/element";
import Tick from "./tick";
import { itemCount } from "@/lib/lessonOrder";
import type Lesson from "@/interface/containers/Lesson";

type Common = { ids: string[]; labels: string[]; onClose: () => void; onDone: (message: string) => void };

// What the action will touch: the first few names, then "+N more".
function Affected({ labels }: { labels: string[] }) {
  const t = useTranslations("elements");
  const shown = labels.slice(0, 4);
  return (
    <p className="text-sm text-muted">
      {shown.join(" · ")}{labels.length > shown.length && <> · {t("bulkMoreItems", { count: labels.length - shown.length })}</>}
    </p>
  );
}

// Shared footer + busy/error handling for the three dialogs.
function useRun(onDone: (m: string) => void) {
  const t = useTranslations("elements");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (job: () => Promise<string>) => {
    setBusy(true); setError(null);
    try { const message = await job(); router.refresh(); onDone(message); }
    catch (e) { setError(e instanceof Error ? e.message : t("bulkFailed")); setBusy(false); }
  };
  return { busy, error, run };
}

function Footer({ busy, disabled, danger, label, onClose, onConfirm, cancelRef }: {
  busy: boolean; disabled?: boolean; danger?: boolean; label: string; onClose: () => void; onConfirm: () => void; cancelRef?: React.Ref<HTMLButtonElement>;
}) {
  const t = useTranslations("elements");
  const tUi = useTranslations("ui");
  return (
    <>
      <button ref={cancelRef} type="button" className="btn btn-secondary min-h-11" disabled={busy} onClick={onClose}>{tUi("cancel")}</button>
      <button type="button" className={`btn min-h-11 ${danger ? "btn-danger" : "btn-primary"}`} disabled={busy || disabled} onClick={onConfirm}>{busy ? t("bulkWorking") : label}</button>
    </>
  );
}

const Error_ = ({ error }: { error: string | null }) => error ? <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>✗ {error}</p> : null;

export type DeleteCopy = { title: string; body: string; confirm: string; done: string };

// Deletes items by default; lessons / languages pass their own `remove` and wording.
export function DeleteDialog({ ids, labels, remove = bulkDeleteElements, copy, onClose, onDone }: Common & { remove?: (ids: string[]) => Promise<unknown>; copy?: DeleteCopy }) {
  const t = useTranslations("elements");
  const { busy, error, run } = useRun(onDone);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { const id = setTimeout(() => cancel.current?.focus(), 0); return () => clearTimeout(id); }, []);   // Enter never deletes by accident
  return (
    <Modal title={copy?.title ?? t("bulkTitle_delete", { count: ids.length })} onClose={() => !busy && onClose()}
      footer={<Footer busy={busy} danger cancelRef={cancel} label={copy?.confirm ?? t("bulkConfirm_delete", { count: ids.length })} onClose={onClose}
        onConfirm={() => run(async () => { await remove(ids); return copy?.done ?? t("bulkDeleted", { count: ids.length }); })} />}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "rgb(181 64 46 / 0.12)", color: "var(--color-danger)" }}><AlertTriangle size={20} aria-hidden /></span>
        <div className="flex flex-col gap-1">
          <p className="text-sm">{copy?.body ?? t("bulkDeleteBody", { count: ids.length })}</p>
          <Affected labels={labels} />
        </div>
      </div>
      <Error_ error={error} />
    </Modal>
  );
}

export function MoveDialog({ ids, labels, lessonId, languageId, onClose, onDone }: Common & { lessonId: string; languageId: string }) {
  const t = useTranslations("elements");
  const { busy, error, run } = useRun(onDone);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [target, setTarget] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => { getAllLessons(languageId).then((ls: Lesson[]) => setLessons(ls.filter((l) => l.id !== lessonId))).catch(() => setLoadError(true)); }, [languageId, lessonId]);
  const shown = (lessons ?? []).filter((l) => l.title.toLowerCase().includes(filter.trim().toLowerCase()));
  const name = lessons?.find((l) => l.id === target)?.title ?? "";
  return (
    <Modal title={t("bulkTitle_move", { count: ids.length })} onClose={() => !busy && onClose()}
      footer={<Footer busy={busy} disabled={!target} label={name ? t("bulkConfirm_moveTo", { name }) : t("bulkConfirm_move")} onClose={onClose}
        onConfirm={() => run(async () => { await bulkMoveElements(ids, target); return t("bulkMoved", { count: ids.length, name }); })} />}>
      <Affected labels={labels} />
      {loadError ? <p role="alert" className="text-sm">{t("bulkLoadFailed")}</p>
        : lessons === null ? <p className="text-sm text-muted">{t("bulkWorking")}</p>
        : lessons.length === 0 ? <p className="text-sm text-muted">{t("bulkNoLessons")}</p> : (
          <>
            {lessons.length > 6 && <input className="input min-h-11" type="search" value={filter} placeholder={t("bulkFilter")} aria-label={t("bulkFilter")} onChange={(e) => setFilter(e.target.value)} />}
            <div role="radiogroup" aria-label={t("bulkMoveTo")} className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {shown.map((l) => (
                <label key={l.id} className="pick-row" data-selected={target === l.id}>
                  <input type="radio" className="tick-input" name="target-lesson" checked={target === l.id} onChange={() => setTarget(l.id)} /><Tick radio />
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  <span className="shrink-0 text-xs text-muted">{t("bulkLessonItems", { count: itemCount(l) })}</span>
                </label>
              ))}
              {shown.length === 0 && <p className="text-sm text-muted">{t("bulkNoMatch")}</p>}
            </div>
          </>
        )}
      <Error_ error={error} />
    </Modal>
  );
}

type Pick = { id: string; label: string; color?: string };
type State = "add" | "remove";

// Tags / sources as chips: tap cycles leave -> add -> remove -> leave, shown with +/- and colour (never colour alone).
export function LinksDialog({ kind, ids, labels, userId, onClose, onDone }: Common & { kind: "tag" | "source"; userId: string }) {
  const t = useTranslations("elements");
  const { busy, error, run } = useRun(onDone);
  const [options, setOptions] = useState<Pick[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [state, setState] = useState<Record<string, State>>({});
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const load = kind === "tag"
      ? getAllUserTags(userId).then((xs: { id: string; name: string; color?: string }[]) => xs.map((x) => ({ id: x.id, label: x.name, color: x.color })))
      : getAllUserSources(userId).then((xs: { id: string; title: string }[]) => xs.map((x) => ({ id: x.id, label: x.title })));
    load.then(setOptions).catch(() => setLoadError(true));
  }, [kind, userId]);
  const cycle = (id: string) => setState((s) => {
    const n = { ...s };
    if (!n[id]) n[id] = "add"; else if (n[id] === "add") n[id] = "remove"; else delete n[id];
    return n;
  });
  const pick = (m: State) => Object.keys(state).filter((k) => state[k] === m);
  const shown = (options ?? []).filter((o) => o.label.toLowerCase().includes(filter.trim().toLowerCase()));
  const edit = kind === "tag" ? bulkEditTags : bulkEditSources;
  const title: ReactNode = t(kind === "tag" ? "bulkTitle_tags" : "bulkTitle_sources", { count: ids.length });
  return (
    <Modal title={String(title)} onClose={() => !busy && onClose()}
      footer={<Footer busy={busy} disabled={Object.keys(state).length === 0} label={t("bulkConfirm_apply")} onClose={onClose}
        onConfirm={() => run(async () => { await edit(ids, pick("add"), pick("remove")); return t("bulkUpdated", { count: ids.length }); })} />}>
      <Affected labels={labels} />
      {loadError ? <p role="alert" className="text-sm">{t("bulkLoadFailed")}</p>
        : options === null ? <p className="text-sm text-muted">{t("bulkWorking")}</p>
        : options.length === 0 ? <p className="text-sm text-muted">{t(kind === "tag" ? "bulkNoTags" : "bulkNoSources")}</p> : (
          <>
            <p className="text-sm text-muted">{t("bulkLegend")}</p>
            {options.length > 8 && <input className="input min-h-11" type="search" value={filter} placeholder={t("bulkFilter")} aria-label={t("bulkFilter")} onChange={(e) => setFilter(e.target.value)} />}
            <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto" role="group" aria-label={t(kind === "tag" ? "bulkTags" : "bulkSources")}>
              {shown.map((o) => (
                <button key={o.id} type="button" className="pick-chip" data-state={state[o.id] ?? "none"} aria-pressed={state[o.id] ? true : false}
                  aria-label={state[o.id] ? `${o.label}: ${t(state[o.id] === "add" ? "bulkAdd" : "bulkRemove")}` : o.label} onClick={() => cycle(o.id)}>
                  {state[o.id] === "add" ? <Plus size={14} aria-hidden /> : state[o.id] === "remove" ? <Minus size={14} aria-hidden />
                    : kind === "tag" ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} aria-hidden /> : null}
                  {o.label}
                </button>
              ))}
              {shown.length === 0 && <p className="text-sm text-muted">{t("bulkNoMatch")}</p>}
            </div>
            {Object.keys(state).length > 0 && <p className="text-sm font-medium" aria-live="polite">{t("bulkWillChange", { add: pick("add").length, remove: pick("remove").length })}</p>}
          </>
        )}
      <Error_ error={error} />
    </Modal>
  );
}
