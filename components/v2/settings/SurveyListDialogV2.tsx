"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, FieldError, TextInput, fieldCls } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { LeadYonalish } from "@/lib/leadSettings";

// So'rovnoma sahifasi (yangi versiya, 24-qism) — savol variantlari va yo'nalish nomlari
// oynalari. Saqlash chaqiruvchida (PUT /api/lead-settings — butun lid sozlamasi).
// Cheklovlar lib/leadSettings.ts → normalizeLeadSettings bilan bir xil: bo'sh/takror
// qiymat tushib qoladi, ro'yxat bo'shasa server sukutga qaytarardi — shu bois bu yerda
// oldindan to'xtatiladi.

export interface ListItem {
  nom: string;
  guruh?: string;
}

const iconBtn =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus disabled:opacity-40 disabled:hover:bg-transparent";

type Draft = ListItem & { k: number };

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export function SurveyListDialogV2({
  title,
  subtitle,
  items,
  min = 1,
  max,
  onClose,
  onSave,
}: {
  title: string;
  subtitle?: string;
  items: ListItem[];
  min?: number;
  max: number;
  onClose: () => void;
  onSave: (items: ListItem[]) => Promise<boolean>;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [draft, setDraft] = useState<Draft[]>(() => items.map((x, i) => ({ ...x, k: i })));
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  // Guruhlar (Chet tili: «Tillar», «Sertifikat va imtihonlar») — birinchi uchragan tartibda.
  const groups = useMemo(() => {
    const out: string[] = [];
    for (const x of items) if (!out.includes(x.guruh ?? "")) out.push(x.guruh ?? "");
    return out.length ? out : [""];
  }, [items]);
  const grouped = groups.some((g) => g);
  const dirty = JSON.stringify(draft.map(({ nom, guruh }) => [norm(nom), guruh ?? ""])) !== JSON.stringify(items.map((x) => [x.nom, x.guruh ?? ""]));

  const clearErr = () => err && setErr("");
  const update = (k: number, nom: string) => {
    setDraft((d) => d.map((x) => (x.k === k ? { ...x, nom } : x)));
    clearErr();
  };
  const remove = (k: number) => {
    setDraft((d) => d.filter((x) => x.k !== k));
    clearErr();
  };
  const move = (k: number, dir: -1 | 1) =>
    setDraft((d) => {
      const i = d.findIndex((x) => x.k === k);
      const g = d[i]?.guruh ?? "";
      let j = i + dir;
      while (j >= 0 && j < d.length && (d[j].guruh ?? "") !== g) j += dir;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = (g: string) => {
    const nom = norm(adding[g] ?? "");
    if (!nom) return;
    if (draft.length >= max) return setErr(t("Ko'pi bilan {n} ta", { n: max }));
    if (draft.some((x) => norm(x.nom).toLowerCase() === nom.toLowerCase())) return setErr(t("«{name}» ro'yxatda bor", { name: nom }));
    const k = Math.max(-1, ...draft.map((x) => x.k)) + 1;
    setDraft((d) => {
      // Guruh oxiriga (guruhsiz ro'yxatda — oxiriga).
      const last = d.map((x) => x.guruh ?? "").lastIndexOf(g);
      const item: Draft = g ? { nom, guruh: g, k } : { nom, k };
      return last < 0 ? [...d, item] : [...d.slice(0, last + 1), item, ...d.slice(last + 1)];
    });
    setAdding((a) => ({ ...a, [g]: "" }));
    clearErr();
  };

  async function submit() {
    const clean = draft.map((x) => ({ ...x, nom: norm(x.nom) }));
    if (clean.some((x) => !x.nom)) return setErr(t("Bo'sh qatorni to'ldiring yoki o'chiring"));
    const seen = new Set<string>();
    for (const x of clean) {
      const key = x.nom.toLowerCase();
      if (seen.has(key)) return setErr(t("«{name}» ikki marta yozilgan", { name: x.nom }));
      seen.add(key);
    }
    if (clean.length < min) return setErr(t("Kamida {n} ta qolsin", { n: min }));
    if (clean.length > max) return setErr(t("Ko'pi bilan {n} ta", { n: max }));
    setSaving(true);
    const ok = await onSave(clean.map(({ nom, guruh }) => (guruh ? { nom, guruh } : { nom })));
    setSaving(false);
    if (ok) modal.close();
  }

  return (
    <V2Dialog
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void submit()}
      width={520}
      footerStart={<span className="text-v2-caption font-normal tabular-nums text-v2-text-3">{t("{n} / {max} ta", { n: draft.length, max })}</span>}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {groups.map((g) => {
          const rows = draft.filter((x) => (x.guruh ?? "") === g);
          return (
            <div key={g || "_"} className="space-y-1.5">
              {grouped && <div className="text-v2-caption font-semibold uppercase tracking-wide text-v2-text-3">{t(g || "Boshqa")}</div>}
              {rows.map((x, i) => (
                <div key={x.k} className="flex items-center gap-1">
                  <input value={x.nom} onChange={(e) => update(x.k, e.target.value)} maxLength={120} aria-label={t("Variant")} className={fieldCls("default", "", "sm")} />
                  <button type="button" onClick={() => move(x.k, -1)} disabled={i === 0} title={t("Yuqoriga")} aria-label={t("{name} — yuqoriga", { name: x.nom })} className={iconBtn}>
                    <ArrowUp className="size-4" strokeWidth={1.75} />
                  </button>
                  <button type="button" onClick={() => move(x.k, 1)} disabled={i === rows.length - 1} title={t("Pastga")} aria-label={t("{name} — pastga", { name: x.nom })} className={iconBtn}>
                    <ArrowDown className="size-4" strokeWidth={1.75} />
                  </button>
                  <button type="button" onClick={() => remove(x.k)} title={t("O'chirish")} aria-label={t("{name} — o'chirish", { name: x.nom })} className={iconBtn}>
                    <X className="size-4" strokeWidth={1.75} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  value={adding[g] ?? ""}
                  onChange={(e) => setAdding((a) => ({ ...a, [g]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    add(g);
                  }}
                  maxLength={120}
                  placeholder={t("Yangi variant")}
                  aria-label={grouped ? t("{group} — yangi variant", { group: t(g || "Boshqa") }) : t("Yangi variant")}
                  className={fieldCls("default", "", "sm")}
                />
                <button type="button" onClick={() => add(g)} disabled={!norm(adding[g] ?? "")} className={`${secondaryBtn} shrink-0 disabled:opacity-50`}>
                  <Plus className="size-4" strokeWidth={2} aria-hidden />
                  {t("Qo'shish")}
                </button>
              </div>
            </div>
          );
        })}
        {err && <FieldError>{err}</FieldError>}
      </div>
    </V2Dialog>
  );
}

/** Yo'nalishlar: nomi (plitka) va birinchi savol («Qaysi fan?»). Yoqish/o'chirish — qatordagi tugmada. */
export function SurveyDirectionsDialogV2({
  yonalishlar,
  onClose,
  onSave,
}: {
  yonalishlar: LeadYonalish[];
  onClose: () => void;
  onSave: (next: LeadYonalish[]) => Promise<boolean>;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [draft, setDraft] = useState(() => yonalishlar.map((y) => ({ id: y.id, nom: y.nom, savol: y.savol })));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = draft.some((d, i) => norm(d.nom) !== yonalishlar[i].nom || norm(d.savol) !== yonalishlar[i].savol);

  const set = (id: string, field: "nom" | "savol", v: string) => {
    setDraft((d) => d.map((x) => (x.id === id ? { ...x, [field]: v } : x)));
    if (err) setErr("");
  };

  async function submit() {
    if (draft.some((d) => !norm(d.nom) || !norm(d.savol))) return setErr(t("Har yo'nalishning nomi va savolini yozing"));
    setSaving(true);
    const ok = await onSave(
      yonalishlar.map((y) => {
        const d = draft.find((x) => x.id === y.id);
        return d ? { ...y, nom: norm(d.nom), savol: norm(d.savol) } : y;
      }),
    );
    setSaving(false);
    if (ok) modal.close();
  }

  return (
    <V2Dialog
      title={t("Yo'nalishlar")}
      subtitle={t("Birinchi qadamdagi plitkalar va ulardan keyingi savol")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void submit()}
      width={520}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {draft.map((d) => (
          <div key={d.id} className="grid gap-3 rounded-v2-md border border-v2-border p-3 min-[30rem]:grid-cols-2">
            <Field label={t("Plitka nomi")} htmlFor={`yon-${d.id}-nom`}>
              <TextInput id={`yon-${d.id}-nom`} value={d.nom} onChange={(e) => set(d.id, "nom", e.target.value)} maxLength={60} autoComplete="off" />
            </Field>
            <Field label={t("Keyingi savol")} htmlFor={`yon-${d.id}-savol`}>
              <TextInput id={`yon-${d.id}-savol`} value={d.savol} onChange={(e) => set(d.id, "savol", e.target.value)} maxLength={80} autoComplete="off" />
            </Field>
          </div>
        ))}
        {err && <FieldError>{err}</FieldError>}
      </div>
    </V2Dialog>
  );
}
