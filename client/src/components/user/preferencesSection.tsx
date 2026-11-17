"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Ban, Dumbbell, Layers, ListOrdered, Plus, Rocket, X, type LucideIcon } from "lucide-react";
import SectionCard from "@/components/ui/sectionCard";
import NumberField from "@/components/ui/input/numberField";
import SortableList from "@/components/ui/sortableList";
import SaveButton from "./saveButton";
import { updateUserPreferences } from "@/api/userPreferences";
import { EXERCISE_TYPE_KEY } from "@/i18n/exerciseTypes";
import { MAX_RATIO, joinPattern, splitPattern, type SideOrder } from "@/utils/sidePattern";
import type UserPreferences from "@/interface/systemData/UserPreferences";
import type { ReviewSection } from "@/interface/systemData/UserPreferences";
import InlineError from "@/components/ui/inlineError";
import ClassicSelectMenu from "@/components/ui/selectMenu/classicSelectMenu";

const SECTION_TYPES: ReviewSection["type"][] = ["voc", "gram", "ex", "call"];
const ORDERS: SideOrder[] = ["random", "alternate", "blocks"];
type Mode = "boost" | "ban";

/** A titled block of the card: icon + title, one line saying what it does, then the controls. */
function Group({ id, icon: Icon, title, hint, children }: { id: string; icon: LucideIcon; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <div className="flex flex-col gap-0.5">
        <h3 id={id} className="inline-flex items-center gap-2 text-sm font-medium"><Icon size={16} aria-hidden />{title}</h3>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

/** Learning preferences: daily goal, vocabulary ratio and order, exercise types to boost or ban, and the daily review plan. */
export default function PreferencesSection({ preferences }: { preferences: Partial<UserPreferences> }) {
  const t = useTranslations("settings.preferences");
  const ts = useTranslations("study");
  const tEx = useTranslations("exercises");
  const initial = splitPattern(preferences.voc_side_pattern);
  const [ratio, setRatio] = useState({ front: initial.front, back: initial.back });
  const [order, setOrder] = useState<SideOrder>(initial.order);
  const [typePrefs, setTypePrefs] = useState<Record<string, Mode>>(preferences.exercise_type_prefs ?? {});
  const [plan, setPlan] = useState<ReviewSection[]>(preferences.review_layout ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const pattern = joinPattern({ ...ratio, order });
  const setMode = (type: string, mode: Mode | null) =>
    setTypePrefs((p) => { const next = { ...p }; if (mode) next[type] = mode; else delete next[type]; return next; });
  const missing = SECTION_TYPES.filter((s) => !plan.some((x) => x.type === s));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern) { setError(ts("invalidPattern")); return; }
    setError("");
    setSaving(true);
    try {
      await updateUserPreferences(preferences.id!, {
        voc_side_pattern: pattern,
        exercise_type_prefs: typePrefs,
        review_layout: plan.length ? plan : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  /** One list (boosted or banned) with a dropdown to add a type and an x to remove it. */
  const typeList = (mode: Mode) => {
    const mine = Object.keys(typePrefs).filter((k) => typePrefs[k] === mode);
    const free = Object.keys(EXERCISE_TYPE_KEY).filter((k) => !typePrefs[k]);
    const Icon = mode === "boost" ? Rocket : Ban;
    return (
      <div className="flex flex-col gap-2" role="group" aria-label={ts(`types_${mode}`)}>
        <span className="inline-flex items-center gap-1 text-sm font-medium"><Icon size={14} aria-hidden />{ts(`types_${mode}`)}</span>
        <div className="flex flex-wrap gap-2 min-h-9">
          {mine.map((type) => (
            <span key={type} className="pref-chip" data-mode={mode}>
              {tEx(EXERCISE_TYPE_KEY[type])}
              <button type="button" aria-label={ts("removeItem", { name: tEx(EXERCISE_TYPE_KEY[type]) })} onClick={() => setMode(type, null)}><X size={14} aria-hidden /></button>
            </span>
          ))}
          {mine.length === 0 && <span className="text-sm text-muted self-center">{ts("typesNone")}</span>}
        </div>
        <ClassicSelectMenu className="w-64 max-w-full" ariaLabel={ts(`addTo_${mode}`)} placeholder={ts("addType")} disabled={free.length === 0} options={free}
          optionLabel={(type) => tEx(EXERCISE_TYPE_KEY[type as keyof typeof EXERCISE_TYPE_KEY])} selectedOption=""
          onChange={(v) => v && setMode(v as string, mode)} />
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <SectionCard title={t("title")} fold>
        <Group id="pref-plan" icon={ListOrdered} title={ts("reviewLayout")} hint={ts("reviewLayoutHint")}>
          {plan.length > 0 && (
            <SortableList ids={plan.map((s) => s.type)} handleLabel={(id) => ts("dragHandle", { section: ts(`section_${id}`) })}
              onReorder={(ids) => setPlan(ids.map((id) => plan.find((s) => s.type === id)!))}>
              {(id, i) => {
                const sec = plan[i];
                return (
                  <>
                    <span className="badge">{i + 1}</span>
                    <span className="flex-1 min-w-24">{ts(`section_${id}`)}</span>
                    <NumberField min={1} ariaLabel={ts("minutesFor", { section: ts(`section_${id}`) })} value={sec.minutes ?? ""} placeholder="–"
                      onChange={(v) => setPlan(plan.map((s, j) => (j === i ? { ...s, minutes: v === "" ? null : v } : s)))} />
                    <span className="text-sm text-muted">{ts("minutes")}</span>
                    <button type="button" className="btn btn-secondary min-h-11 min-w-11" aria-label={ts("removeItem", { name: ts(`section_${id}`) })} onClick={() => setPlan(plan.filter((_, j) => j !== i))}><X size={16} aria-hidden /></button>
                  </>
                );
              }}
            </SortableList>
          )}
          {missing.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {plan.length === 0 && <span className="text-sm text-muted">{ts("planEmpty")}</span>}
              {missing.map((s) => (
                <button key={s} type="button" className="filter-chip inline-flex items-center gap-1 min-h-11 px-4 text-sm" onClick={() => setPlan([...plan, { type: s, minutes: null }])}>
                  <Plus size={14} aria-hidden />{ts(`section_${s}`)}
                </button>
              ))}
            </div>
          )}
        </Group>

        <div className="index-divider" />
        <Group id="pref-vocab" icon={Layers} title={ts("vocabMix")} hint={ts("vocabMixHint")}>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm opacity-70">{ts("ratioLabel")}</span>
              <span className="flex items-center gap-2 text-sm">
                <NumberField max={MAX_RATIO} ariaLabel={ts("front")} value={ratio.front} disabled={order === "blocks"} onChange={(v) => setRatio({ ...ratio, front: v === "" ? 0 : v })} />
                <span aria-hidden>:</span>
                <NumberField max={MAX_RATIO} ariaLabel={ts("back")} value={ratio.back} disabled={order === "blocks"} onChange={(v) => setRatio({ ...ratio, back: v === "" ? 0 : v })} />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm opacity-70" id="pref-order-label">{ts("orderLabel")}</span>
              <div className="filter-chips" role="group" aria-labelledby="pref-order-label">
                {ORDERS.map((o) => (
                  <button key={o} type="button" aria-pressed={order === o} className={`filter-chip min-h-11 px-4 text-sm ${order === o ? "active" : ""}`} onClick={() => setOrder(o)}>{ts(`order_${o}`)}</button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-sm text-muted">{ts(`orderHint_${order}`)}</p>
        </Group>

        <div className="index-divider" />
        <Group id="pref-types" icon={Dumbbell} title={ts("exerciseTypes")} hint={ts("exerciseTypesHint")}>
          <div className="grid gap-4 sm:grid-cols-2">{typeList("boost")}{typeList("ban")}</div>
        </Group>

        {error && <InlineError>{error}</InlineError>}
        <div><SaveButton isLoading={saving} /></div>
      </SectionCard>
    </form>
  );
}
