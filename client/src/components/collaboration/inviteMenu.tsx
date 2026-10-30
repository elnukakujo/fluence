"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Layers, Search, UserMinus, UserPlus, X } from "lucide-react";
import { listUsers, listCollaborators, invite, remove, listLessonRecipients, unshareLesson, listLanguageLessons } from "@/api/collaboration";
import ConfirmDialog from "@/components/user/confirmDialog";

// `shared` = a lesson recipient (access is the share itself, there is no collaboration row to cancel)
type Collab = { id: string; status: string; mode?: string | null; shared?: boolean };
type User = { id: string; display_name: string };
type Offer = "full" | "partial";

const STATUS: Record<string, { label: string; tone: string }> = {
  accepted: { label: "Collaborating", tone: "var(--color-success)" },
  pending: { label: "Invite sent", tone: "var(--color-warning)" },
  awaiting_master_consent: { label: "Awaiting your approval", tone: "var(--color-warning)" },
};

const OFFERS: { value: Offer; title: string; body: string; Icon: typeof Globe }[] = [
  { value: "full", title: "Whole language", body: "Co-edit everything, now and later.", Icon: Globe },
  { value: "partial", title: "Some lessons", body: "Share only the lessons you pick.", Icon: Layers },
];

function Avatar({ name, active }: { name: string; active: boolean }) {
  return <span aria-hidden className={`avatar ${active ? "avatar-active" : ""}`}>{name.trim().charAt(0).toUpperCase() || "?"}</span>;
}

export default function InviteMenu({ targetType, targetId }: {
  targetType: "language" | "lesson";
  targetId: string;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [collaborators, setCollaborators] = useState<Record<string, Collab>>({});
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [removing, setRemoving] = useState<User | null>(null);
  const [offerMode, setOfferMode] = useState<Offer>("full");
  const [lessons, setLessons] = useState<{ id: string; title: string }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const latest = useRef(0);

  // Debounce typing; the server matches name, username and email but only returns display names.
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  async function load() {
    const ticket = ++latest.current;
    setSearching(true);
    try {
      const [allUsers, collabs, recipients] = await Promise.all([
        listUsers(term), listCollaborators(targetType, targetId),
        targetType === "lesson" ? listLessonRecipients(targetId) : Promise.resolve([]),
      ]);
      if (ticket !== latest.current) return; // a newer search superseded this one
      setUsers(allUsers);
      setCollaborators({
        ...Object.fromEntries(collabs.map((c) => [c.collaborator_id, c as Collab])),
        ...Object.fromEntries(recipients.map((r) => [r.user_id, { id: "", status: "accepted", shared: true } as Collab])),
      });
      setError(null);
    } catch (e) {
      if (ticket === latest.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (ticket === latest.current) { setLoading(false); setSearching(false); }
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [targetType, targetId, term]);

  useEffect(() => {
    if (targetType !== "language") return;
    listLanguageLessons(targetId).then(setLessons).catch(() => setLessons([]));
  }, [targetType, targetId]);

  async function run(userId: string, action: () => Promise<unknown>, fallback: string) {
    setBusy(userId);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(null);
    }
  }

  const isLanguage = targetType === "language";
  const offer = isLanguage ? { mode: offerMode, lessonIds: lessons.filter((l) => picked.has(l.id)).map((l) => l.id) } : undefined;
  const offerInvalid = isLanguage && offerMode === "partial" && picked.size === 0;
  const allPicked = lessons.length > 0 && picked.size === lessons.length;
  const people = [...users].sort((a, b) => a.display_name.localeCompare(b.display_name));
  const inCircle = people.filter((u) => collaborators[u.id]);
  const others = people.filter((u) => !collaborators[u.id]);

  function row(u: User) {
    const collab = collaborators[u.id];
    const status = collab && STATUS[collab.status];
    const disabled = busy === u.id;
    return (
      <li key={u.id} className="person-row">
        <Avatar name={u.display_name} active={collab?.status === "accepted"} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{u.display_name}</span>
          {status && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: status.tone }}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: status.tone }} />
              {status.label}
              {collab.status === "accepted" && collab.mode && ` · ${collab.mode === "partial" ? "Some lessons" : "Whole language"}`}
            </span>
          )}
        </span>
        {!collab ? (
          <button type="button" className="btn btn-primary !px-3" disabled={disabled || offerInvalid}
            title={offerInvalid ? "Pick at least one lesson first" : undefined}
            aria-label={`Invite ${u.display_name}`}
            onClick={() => run(u.id, () => invite(u.id, targetType, targetId, offer), "Failed to invite")}>
            <UserPlus size={15} aria-hidden /> {disabled ? "Inviting…" : "Invite"}
          </button>
        ) : collab.status === "pending" ? (
          <button type="button" className="btn btn-secondary !px-3" disabled={disabled}
            aria-label={`Cancel invite to ${u.display_name}`}
            onClick={() => run(u.id, () => remove(collab.id), "Failed to cancel invite")}>
            Cancel
          </button>
        ) : collab.status === "accepted" ? (
          <button type="button" className="btn btn-secondary !px-3" disabled={disabled}
            aria-label={`Remove ${u.display_name}`} onClick={() => setRemoving(u)}>
            <UserMinus size={15} aria-hidden /> Remove
          </button>
        ) : null}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}

      {isLanguage && (
        <section aria-label="What to share" className="flex flex-col gap-2">
          <div role="radiogroup" aria-label="What to share" className="flex flex-col gap-2 sm:flex-row">
            {OFFERS.map(({ value, title, body, Icon }) => (
              <button key={value} type="button" role="radio" aria-checked={offerMode === value}
                className="choice" onClick={() => setOfferMode(value)}>
                <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="text-xs text-muted">{body}</span>
                </span>
              </button>
            ))}
          </div>
          {offerMode === "partial" && (
            <fieldset className="flex flex-col gap-1 rounded-xl border border-border p-2">
              <legend className="flex w-full items-center justify-between px-1 text-xs text-muted">
                <span>{picked.size}/{lessons.length} lessons</span>
                {lessons.length > 0 && (
                  <button type="button" className="text-accent underline"
                    onClick={() => setPicked(new Set(allPicked ? [] : lessons.map((l) => l.id)))}>
                    {allPicked ? "Select none" : "Select all"}
                  </button>
                )}
              </legend>
              {lessons.length === 0 && <p className="px-1 py-2 text-sm text-muted">This language has no lessons yet.</p>}
              <ul className="flex max-h-36 flex-col overflow-y-auto">
                {lessons.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-accent-soft">
                      <input type="checkbox" checked={picked.has(l.id)}
                        onChange={() => setPicked((prev) => { const n = new Set(prev); if (!n.delete(l.id)) n.add(l.id); return n; })} />
                      <span className="truncate">{l.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {offerInvalid && lessons.length > 0 && (
                <p className="px-1 text-xs text-muted">Pick at least one lesson to enable invites.</p>
              )}
            </fieldset>
          )}
        </section>
      )}

      <div className="search-field">
        <Search size={16} aria-hidden />
        <input type="search" className="input" placeholder="Search by name, username or email"
          aria-label="Search people" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button type="button" aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-accent-soft"
            onClick={() => { setQuery(""); setTerm(""); }}>
            <X size={14} aria-hidden />
          </button>
        )}
      </div>

      {loading ? (
        <div aria-busy="true" aria-label="Loading people" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-12" />)}
        </div>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity ${searching ? "opacity-60" : ""}`}>
          <p className="sr-only" role="status" aria-live="polite">
            {people.length} {people.length === 1 ? "person" : "people"} found
          </p>
          {people.length === 0 && (
            <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted">
              {term ? <>No one matches “{term}”.</> : "No other users yet."}
            </p>
          )}
          {inCircle.length > 0 && (
            <section aria-label="Already invited">
              <h4 className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
                {targetType === "lesson" ? "Shared with" : "Already invited"}
              </h4>
              <ul className="flex flex-col">{inCircle.map(row)}</ul>
            </section>
          )}
          {others.length > 0 && (
            <section aria-label="People">
              <h4 className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
                {term ? "Results" : "People"}
              </h4>
              <ul className="flex max-h-72 flex-col overflow-y-auto">{others.map(row)}</ul>
            </section>
          )}
        </div>
      )}

      {removing && (
        <ConfirmDialog
          danger
          confirmLabel="Remove"
          message={`Remove ${removing.display_name}? ${
            collaborators[removing.id]?.mode === "partial" || collaborators[removing.id]?.shared
              ? "They lose access to your shared lessons."
              : "They keep a copy of the content in their own account."}`}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const target = removing;
            setRemoving(null);
            const c = collaborators[target.id];
            run(target.id, () => c.shared ? unshareLesson(targetId, target.id) : remove(c.id), "Failed to remove");
          }}
        />
      )}
    </div>
  );
}
