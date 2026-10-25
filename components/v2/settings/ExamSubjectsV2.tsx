"use client";

import { useState } from "react";
import { Award, Loader2, Lock, MoreHorizontal, Pencil, Plus, Power, RefreshCw, Trash2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { Field, TextInput, fieldCls } from "@/components/v2/form/fields";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { fmtNum, useUbConfig } from "@/components/v2/imtihon/uzbmb/ubCore";
import { UB_K_MAX, UB_K_MIN, UB_NAME_MAX, UB_Q_MAX, sameSubject, schemeMax, type UbConfig, type UbPart, type UbScheme, type UbSubject } from "@/lib/uzbmb";

// YANGI VERSIYA — SOZLAMALAR → O'QUV → «IMTIHON FANLARI» (rasm «Sozlamalar · Imtihon fanlari»,
// yorug'/qorong'i, 25.10.2026; `/settings-academic?tab=exam-subjects`):
//   • sarlavha «O'quv» / «Imtihon fanlari» / izoh, o'ngda «+ Fan qo'shish»;
//   • «UzBMB ball tuzilishi» — Bo'lim | Savollar | Koeffitsiyent | Maks. ball (1-blok, 2-blok, Majburiy
//     fanlar «33 · 3 × 11», Jami 189); o'zgarsa «Saqlash» qatori chiqadi — faqat YANGI testlarga ta'sir
//     qiladi (test yaratilganda tuzilishi o'ziga yoziladi, lib/uzbmb.ts);
//   • «Fanlar» — Fan (majburiylar 🔒) | Qayerda («Majburiy», «Majburiy · blokda ham», «Blok fani») | Holat |
//     ✎ ⋯; pastda «+ Yangi fan qo'shish»; izoh — sertifikat bali qo'lda, koeffitsiyentsiz.
// Saqlash — PUT /api/imtihon/uzbmb/config (Sozlamalar → O'quv ruxsati). Rasmdagi «Namuna» — dizayner izohi.

const th = "bg-v2-surface-2 px-3 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";

type PartKey = keyof UbScheme;
type SchemeDraft = Record<PartKey, { q: string; k: string }>;

const kText = (k: number) => String(k).replace(".", ",");
const draftOf = (s: UbScheme): SchemeDraft => ({
  b1: { q: String(s.b1.q), k: kText(s.b1.k) },
  b2: { q: String(s.b2.q), k: kText(s.b2.k) },
  maj: { q: String(s.maj.q), k: kText(s.maj.k) },
});
function partOf(d: { q: string; k: string }): UbPart | null {
  const q = Number(d.q);
  const k = Number(d.k.replace(",", "."));
  if (!Number.isInteger(q) || q < 1 || q > UB_Q_MAX) return null;
  if (!Number.isFinite(k) || k < UB_K_MIN || k > UB_K_MAX) return null;
  return { q, k: Math.round(k * 100) / 100 };
}

async function putConfig(body: object): Promise<{ ok: true; config: UbConfig } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/imtihon/uzbmb/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    return d.ok ? { ok: true, config: d.config as UbConfig } : { ok: false, error: String(d.error || "Saqlanmadi") };
  } catch {
    return { ok: false, error: "Serverga ulanib bo'lmadi" };
  }
}

export default function ExamSubjectsV2() {
  const { t, lang } = useT();
  const { showSuccess, showError } = useToast();
  const { config, canEdit, error, reload, setConfig } = useUbConfig();
  const [draft, setDraft] = useState<SchemeDraft | null>(null);
  const [savingScheme, setSavingScheme] = useState(false);
  const [form, setForm] = useState<null | { subject: UbSubject | null }>(null);
  const [del, setDel] = useState<UbSubject | null>(null);

  const cur = draft ?? (config ? draftOf(config.scheme) : null);
  const parts = cur ? { b1: partOf(cur.b1), b2: partOf(cur.b2), maj: partOf(cur.maj) } : null;
  const valid = parts && parts.b1 && parts.b2 && parts.maj ? ({ b1: parts.b1, b2: parts.b2, maj: parts.maj } as UbScheme) : null;
  const max = valid ? schemeMax(valid) : config ? schemeMax(config.scheme) : null;
  const schemeDirty = Boolean(draft && config && JSON.stringify(valid) !== JSON.stringify(config.scheme));
  const mandatory = config ? config.subjects.filter((s) => s.maj) : [];

  async function saveScheme() {
    if (!valid) return showError(t("Savollar soni 1 dan 100 gacha, koeffitsiyent 0,1 dan 10 gacha bo'lsin"));
    setSavingScheme(true);
    const r = await putConfig({ scheme: valid });
    setSavingScheme(false);
    if (!r.ok) return showError(t(r.error));
    setConfig(r.config);
    setDraft(null);
    showSuccess(t("Ball tuzilishi saqlandi — yangi testlarga qo'llanadi"));
  }

  async function saveSubjects(subjects: UbSubject[], message: string): Promise<boolean> {
    const r = await putConfig({ subjects });
    if (!r.ok) {
      showError(t(r.error));
      return false;
    }
    setConfig(r.config);
    showSuccess(message);
    return true;
  }

  const setPart = (key: PartKey, field: "q" | "k", raw: string) => {
    if (!cur) return;
    const v = field === "q" ? raw.replace(/\D/g, "").slice(0, 3) : raw.replace(/\./g, ",").replace(/[^\d,]/g, "").slice(0, 5);
    setDraft({ ...cur, [key]: { ...cur[key], [field]: v } });
  };

  const partRow = (key: PartKey, title: string, sub: string) => {
    const d = cur?.[key];
    const p = parts?.[key] ?? null;
    const one = p ? Math.round(p.q * p.k * 10) / 10 : null;
    return (
      <tr className="border-b border-v2-border">
        <td className="py-2.5 pl-4 pr-3">
          <span className="block text-v2-small font-semibold text-v2-text">{title}</span>
          <span className="block text-v2-caption font-normal text-v2-text-2">{sub}</span>
        </td>
        <td className="px-3 py-2.5">
          <div className="w-16">
            <input
              value={d?.q ?? ""}
              onChange={(e) => setPart(key, "q", e.target.value)}
              disabled={!canEdit || !d}
              inputMode="numeric"
              aria-label={t("{part} — savollar soni", { part: title })}
              className={fieldCls(d && !partOf({ q: d.q, k: "1" }) ? "error" : "default", "font-semibold tabular-nums", "sm")}
            />
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="w-16">
            <input
              value={d?.k ?? ""}
              onChange={(e) => setPart(key, "k", e.target.value)}
              disabled={!canEdit || !d}
              inputMode="decimal"
              aria-label={t("{part} — koeffitsiyent", { part: title })}
              className={fieldCls(d && !partOf({ q: "1", k: d.k }) ? "error" : "default", "font-semibold tabular-nums", "sm")}
            />
          </div>
        </td>
        <td className="py-2.5 pl-3 pr-4 text-right text-v2-small tabular-nums">
          {one === null ? (
            <span className="text-v2-text-3">—</span>
          ) : key === "maj" ? (
            <>
              <span className="font-semibold text-v2-text">{fmtNum(Math.round(one * 3 * 10) / 10, lang)}</span>
              <span className="text-v2-text-3"> · 3 × {fmtNum(one, lang)}</span>
            </>
          ) : (
            <span className="font-semibold text-v2-text">{fmtNum(one, lang)}</span>
          )}
        </td>
      </tr>
    );
  };

  const whereChip = (s: UbSubject) => {
    const label = s.maj ? (s.block ? t("Majburiy · blokda ham") : t("Majburiy")) : t("Blok fani");
    return <span className="inline-flex whitespace-nowrap rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 py-px text-v2-caption text-v2-text-2">{label}</span>;
  };

  const menuOf = (s: UbSubject): ActionMenuEntry[] => {
    if (!config) return [];
    const replace = (next: UbSubject) => config.subjects.map((x) => (x.id === s.id ? next : x));
    if (s.maj) {
      return [
        {
          key: "block",
          label: s.block ? t("Blokda tanlanmasin") : t("Blokda ham tanlansin"),
          icon: Power,
          onSelect: () => void saveSubjects(replace({ ...s, block: !s.block }), s.block ? t("«{name}» endi faqat majburiy", { name: s.name }) : t("«{name}» blok fani sifatida ham tanlanadi", { name: s.name })),
        },
      ];
    }
    return [
      {
        key: "active",
        label: s.active ? t("Faolsizlantirish") : t("Faollashtirish"),
        icon: Power,
        onSelect: () => void saveSubjects(replace({ ...s, active: !s.active }), s.active ? t("«{name}» faolsizlantirildi", { name: s.name }) : t("«{name}» faollashtirildi", { name: s.name })),
      },
      { key: "d", divider: true },
      { key: "del", label: t("O'chirish"), icon: Trash2, danger: true, onSelect: () => setDel(s) },
    ];
  };

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[44rem]">
          <div className="text-v2-caption text-v2-text-2">{t("O'quv")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Imtihon fanlari")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{t("UzBMB testidagi bloklar va majburiy fanlar. Natija kiritishda ball shu tuzilish bo'yicha avtomatik hisoblanadi.")}</p>
        </div>
        {canEdit && config && (
          <button type="button" onClick={() => setForm({ subject: null })} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Fan qo'shish")}
          </button>
        )}
      </div>

      {error && !config ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
          <p className="text-v2-body text-v2-text-2">{t(error)}</p>
          <button type="button" onClick={reload} className={`${secondaryBtn} mt-3`}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      ) : (
        <>
          {/* 2. Ball tuzilishi */}
          <section className="shrink-0 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm" aria-label={t("UzBMB ball tuzilishi")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <h2 className="text-v2-section text-v2-text">{t("UzBMB ball tuzilishi")}</h2>
              <span className="text-v2-caption font-normal text-v2-text-3">{t("o'zgarsa, faqat yangi testlarga ta'sir qiladi")}</span>
            </div>
            <div className="relative overflow-x-auto overflow-y-hidden">
              <table className="w-full min-w-[34rem] border-collapse">
                <thead>
                  <tr>
                    <th className={`${th} pl-4`}>{t("Bo'lim")}</th>
                    <th className={`${th} w-[120px]`}>{t("Savollar")}</th>
                    <th className={`${th} w-[140px]`}>{t("Koeffitsiyent")}</th>
                    <th className={`${th} w-[150px] pr-4 text-right`}>{t("Maks. ball")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!config ? (
                    Array.from({ length: 3 }, (_, i) => (
                      <tr key={i} className="h-[58px] border-b border-v2-border" aria-hidden>
                        <td className="pl-4 pr-3">
                          <div className="h-3 w-28 rounded bg-v2-skeleton" />
                        </td>
                        <td className="px-3">
                          <div className="h-8 w-[72px] rounded-v2-md bg-v2-skeleton" />
                        </td>
                        <td className="px-3">
                          <div className="h-8 w-[72px] rounded-v2-md bg-v2-skeleton" />
                        </td>
                        <td />
                      </tr>
                    ))
                  ) : (
                    <>
                      {partRow("b1", t("1-blok"), t("yo'nalishning birinchi fani"))}
                      {partRow("b2", t("2-blok"), t("yo'nalishning ikkinchi fani"))}
                      {partRow("maj", t("Majburiy fanlar"), mandatory.map((s) => s.name).join(", "))}
                      <tr>
                        <td colSpan={3} className="py-3 pl-4 text-v2-small font-semibold text-v2-text">
                          {t("Jami")}
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right text-v2-body font-semibold tabular-nums text-v2-text">{max ? fmtNum(max.total, lang) : "—"}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
            {draft && (
              <div className="flex flex-col gap-2 border-t border-v2-border bg-v2-surface-2 px-4 py-3 min-[40rem]:flex-row min-[40rem]:items-center">
                <span className={`min-w-0 flex-1 text-v2-small ${valid ? "text-v2-text-2" : "text-v2-danger"}`}>
                  {valid ? (schemeDirty ? t("O'zgarish saqlanmagan") : t("O'zgarish yo'q")) : t("Savollar soni 1 dan 100 gacha, koeffitsiyent 0,1 dan 10 gacha bo'lsin")}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDraft(null)} disabled={savingScheme} className={secondaryBtn}>
                    {t("Bekor qilish")}
                  </button>
                  <button type="button" onClick={() => void saveScheme()} disabled={savingScheme || !valid || !schemeDirty} className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
                    {savingScheme && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
                    {t("Saqlash")}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 3. Fanlar */}
          <section className="shrink-0 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm" aria-label={t("Fanlar")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <h2 className="text-v2-section text-v2-text">{t("Fanlar")}</h2>
              <span className="text-v2-caption font-normal text-v2-text-3">{t("guruh yo'nalishi shu fanlardan tanlanadi")}</span>
            </div>
            <div className="relative overflow-x-auto overflow-y-hidden">
              <table className="w-full min-w-[34rem] border-collapse">
                <thead>
                  <tr>
                    <th className={`${th} pl-4`}>{t("Fan")}</th>
                    <th className={`${th} w-[34%]`}>{t("Qayerda")}</th>
                    <th className={`${th} w-[130px]`}>{t("Holat")}</th>
                    <th className={`${th} w-[84px] pr-3`}>
                      <span className="sr-only">{t("Amallar")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!config &&
                    Array.from({ length: 5 }, (_, i) => (
                      <tr key={i} className="h-[45px] border-b border-v2-border" aria-hidden>
                        <td className="pl-4">
                          <div className="h-3 w-32 rounded bg-v2-skeleton" />
                        </td>
                        <td className="px-3">
                          <div className="h-5 w-20 rounded bg-v2-skeleton" />
                        </td>
                        <td className="px-3">
                          <div className="h-3 w-12 rounded bg-v2-skeleton" />
                        </td>
                        <td />
                      </tr>
                    ))}
                  {config?.subjects.map((s) => (
                    <tr key={s.id} className={`border-b border-v2-border last:border-b-0 ${s.active ? "" : "opacity-70"}`}>
                      <td className="py-2.5 pl-4 pr-3">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-v2-small font-semibold text-v2-text">{s.name}</span>
                          {s.maj && <Lock className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-label={t("Majburiy fan — o'chirilmaydi")} />}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{whereChip(s)}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-v2-small text-v2-text">
                          <span className={`size-1.5 rounded-full ${s.active ? "bg-v2-success" : "bg-v2-text-3"}`} aria-hidden />
                          {s.active ? t("Faol") : t("Faol emas")}
                        </span>
                      </td>
                      <td className="py-2.5 pl-1 pr-3 text-right">
                        {canEdit && (
                          <span className="inline-flex items-center gap-0.5">
                            <button type="button" onClick={() => setForm({ subject: s })} title={t("Tahrirlash")} aria-label={t("{name} — tahrirlash", { name: s.name })} className={iconBtn}>
                              <Pencil className="size-4" strokeWidth={1.75} />
                            </button>
                            <ActionMenu items={menuOf(s)} label={t("{name} — amallar", { name: s.name })} width={232}>
                              {(trigger, open) => (
                                <button type="button" {...trigger} title={t("Amallar")} aria-label={t("{name} — amallar", { name: s.name })} className={`${iconBtn} ${open ? "bg-v2-surface-2" : ""}`}>
                                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                                </button>
                              )}
                            </ActionMenu>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit && config && (
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => setForm({ subject: null })}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-v2-md border border-dashed border-v2-border-strong text-v2-small font-semibold text-v2-brand-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus"
                >
                  <Plus className="size-4" strokeWidth={2} aria-hidden />
                  {t("Yangi fan qo'shish")}
                </button>
              </div>
            )}
          </section>

          <p className="flex items-start gap-1.5 text-v2-caption font-normal text-v2-text-2">
            <Award className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {t("Sertifikati bor o'quvchining shu fandagi bali natija kiritishda qo'lda yoziladi — koeffitsiyent qo'llanmaydi.")}
          </p>
        </>
      )}

      {form && config && (
        <SubjectDialog
          subject={form.subject}
          config={config}
          onClose={() => setForm(null)}
          onSave={(subjects, message) => saveSubjects(subjects, message)}
        />
      )}
      {del && config && (
        <V2Confirm
          title={t("«{name}» fanini o'chirasizmi?", { name: del.name })}
          body={t("Ro'yxatdan olib tashlanadi. Oldingi natijalarda fan nomi saqlanib qoladi.")}
          confirmLabel={t("O'chirish")}
          cancelLabel={t("Bekor qilish")}
          onCancel={() => setDel(null)}
          onConfirm={() => {
            const s = del;
            setDel(null);
            void saveSubjects(
              config.subjects.filter((x) => x.id !== s.id),
              t("«{name}» o'chirildi", { name: s.name }),
            );
          }}
        />
      )}
    </div>
  );
}

function SubjectDialog({
  subject,
  config,
  onClose,
  onSave,
}: {
  subject: UbSubject | null;
  config: UbConfig;
  onClose: () => void;
  onSave: (subjects: UbSubject[], message: string) => Promise<boolean>;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [name, setName] = useState(subject?.name ?? "");
  const [block, setBlock] = useState(subject?.block ?? true);
  const [active, setActive] = useState(subject?.active ?? true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const locked = Boolean(subject?.maj);
  const dirty = subject ? name.trim() !== subject.name || block !== subject.block || active !== subject.active : Boolean(name.trim());

  async function submit() {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return setErr(t("Fan nomini kiriting"));
    if (config.subjects.some((s) => s.id !== subject?.id && sameSubject(s.name, clean))) return setErr(t("«{name}» fani ro'yxatda bor", { name: clean }));
    const next: UbSubject[] = subject
      ? config.subjects.map((s) => (s.id === subject.id ? { ...s, name: locked ? s.name : clean, block: locked ? block : true, active: locked ? true : active } : s))
      : [...config.subjects, { id: `s${Date.now().toString(36)}`, name: clean, block: true, active: true }];
    setSaving(true);
    const ok = await onSave(next, subject ? t("«{name}» saqlandi", { name: clean }) : t("«{name}» qo'shildi", { name: clean }));
    setSaving(false);
    if (ok) modal.close();
  }

  return (
    <V2Dialog
      title={subject ? t("Fanni tahrirlash") : t("Fan qo'shish")}
      subtitle={locked ? t("Majburiy fan — nomi o'zgarmaydi") : t("Blok fani — guruh yo'nalishida 1-blok yoki 2-blok sifatida tanlanadi")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void submit()}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {subject ? t("Saqlash") : t("Qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")} htmlFor="ub-subject-name" error={err || undefined}>
          <TextInput
            id="ub-subject-name"
            value={name}
            disabled={locked}
            onChange={(e) => {
              setName(e.target.value);
              if (err) setErr("");
            }}
            maxLength={UB_NAME_MAX}
            placeholder={t("Masalan: Informatika")}
            autoComplete="off"
          />
        </Field>
        {locked ? (
          <label className="flex cursor-pointer items-start gap-2.5 text-v2-small text-v2-text">
            <V2Checkbox checked={block} onChange={setBlock} label={t("Blok fani sifatida ham tanlansin")} className="mt-0.5" />
            <span>
              {t("Blok fani sifatida ham tanlansin")}
              <span className="block text-v2-caption font-normal text-v2-text-3">{t("Masalan, Matematika — Fizika yo'nalishida 1-blok")}</span>
            </span>
          </label>
        ) : (
          subject && (
            <label className="flex cursor-pointer items-center gap-2.5 text-v2-small text-v2-text">
              <V2Checkbox checked={active} onChange={setActive} label={t("Faol")} />
              {t("Faol — yo'nalish tanlashda ko'rinadi")}
            </label>
          )
        )}
      </div>
    </V2Dialog>
  );
}
