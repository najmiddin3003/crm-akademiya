"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Loader2, Pencil, Plus, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { TextInput } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar, TH } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";

// YANGI VERSIYA — SOZLAMALAR → O'QUV → «BAHOLASH» darajalari (41-qism, rasm «Sozlamalar · Baholash · darajalar»).
// O'zlashtirish darajalari: 0–100% shkala chizig'i, jadval (minimal, maksimal, rang), qamrov tekshiruvi (bo'shliq va
// ustma-ust tushish), pastda qo'shish/tahrirlash formasi (tayyor ranglar). O'ngda namuna sarhisob va «Qayerda
// ko'rinadi». Ro'yxat eski tab bilan bir (`settings_assessment_levels`, /api/settings-lists). Imtihon sarhisobi va
// kabinet hali bu darajalarni ko'rsatmaydi (SAVOLLAR 534). Mavsumiy baholash mezonlari — o'z sahifasida.

type Row = { id: number; name: string; minPercent?: string; maxPercent?: string; color?: string };
type Lvl = { id: number; name: string; min: number; max: number; color: string };

const PALETTE: { hex: string; name: string }[] = [
  { hex: "#15803d", name: "yashil" },
  { hex: "#0f766e", name: "feruza" },
  { hex: "#2563eb", name: "ko'k" },
  { hex: "#7c3aed", name: "binafsha" },
  { hex: "#b45309", name: "sariq" },
  { hex: "#dc2626", name: "qizil" },
  { hex: "#64748b", name: "kulrang" },
];
const num = (s: unknown) => {
  const n = Number(String(s ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const colorName = (hex: string) => PALETTE.find((p) => p.hex === hex.toLowerCase())?.name ?? "";

/** Qamrov: 0–100 oraliqdagi bo'shliqlar va ustma-ust tushishlar. */
function coverage(levels: Lvl[]) {
  const s = [...levels].sort((a, b) => a.min - b.min);
  const gaps: string[] = [];
  const overlaps: string[] = [];
  let cur = 0;
  for (const l of s) {
    if (l.min > cur) gaps.push(`${cur}–${l.min - 1}%`);
    if (l.min < cur) overlaps.push(l.name);
    cur = Math.max(cur, l.max + 1);
  }
  if (cur <= 100) gaps.push(`${cur}–100%`);
  return { gaps, overlaps };
}

export default function AssessmentLevelsV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<{ ok: true; items: Row[] }>("/api/settings-lists?kind=assessment-levels");
  const [form, setForm] = useState<{ id?: number; name: string; min: string; max: string; color: string } | null>(null);
  const [del, setDel] = useState<Lvl | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <div className="p-6"><NoticeBar>{t("Ma'lumotni yuklab bo'lmadi")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const levels: Lvl[] = d.items.map((r) => ({ id: r.id, name: r.name, min: num(r.minPercent), max: num(r.maxPercent), color: (r.color || "#64748b").toLowerCase() })).sort((a, b) => b.min - a.min);
  const cov = coverage(levels);
  const asc = [...levels].reverse();

  // Formadagi qiymat bilan to'qnashuv (o'zini hisobga olmasdan).
  const fMin = form ? num(form.min) : 0;
  const fMax = form ? num(form.max) : 0;
  const clash = form ? levels.find((l) => l.id !== form.id && fMin <= l.max && fMax >= l.min) : undefined;
  const formErr = !form ? "" : !form.name.trim() ? t("Nomini kiriting") : form.min === "" || form.max === "" ? t("Foizlarni kiriting") : fMin > fMax || fMax > 100 ? t("Oraliq noto'g'ri: 0–100, minimal ≤ maksimal") : "";

  async function submit() {
    if (!form || formErr || clash) return;
    setBusy(true);
    const body = { name: form.name.trim(), minPercent: String(fMin), maxPercent: String(fMax), color: form.color };
    const url = form.id ? `/api/settings-lists/${form.id}?kind=assessment-levels` : "/api/settings-lists?kind=assessment-levels";
    const r = await fetch(url, { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(form.id ? t("Saqlandi") : t("Qo'shildi"));
    setForm(null);
    reload();
  }
  async function remove(l: Lvl) {
    const r = await fetch(`/api/settings-lists/${l.id}?kind=assessment-levels`, { method: "DELETE" })
      .then((x) => x.json())
      .catch(() => null);
    setDel(null);
    if (!r?.ok) return showError(t(r?.error || "O'chirib bo'lmadi"));
    showSuccess(t("O'chirildi"));
    reload();
  }
  const levelOf = (p: number) => levels.find((l) => p >= l.min && p <= l.max);
  const sample = [88, 84, 76, 64, 48];

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-v2-small text-v2-text-2">{t("O'quv")}</div>
          <h1 className="text-v2-page text-v2-text">{t("Baholash")}</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("O'quvchi natijasi foizi shu darajalar bo'yicha nomlanadi va rangda ko'rinadi.")}</p>
        </div>
        <button type="button" onClick={() => setForm({ name: "", min: "", max: "", color: PALETTE[0].hex })} className={primaryBtn}>
          <Plus className="size-4" aria-hidden /> {t("Daraja qo'shish")}
        </button>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand">
                <BarChart3 className="size-4" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold text-v2-text">
                  {t("O'zlashtirish darajalari")} · {levels.length}
                </h2>
                <p className="text-v2-small text-v2-text-2">{t("O'quvchining foizi qaysi oraliqqa tushsa, shu daraja chiqadi")}</p>
              </div>
            </div>
            {levels.length > 0 && (
              <>
                <div className="relative flex h-9 overflow-hidden rounded-v2-md bg-v2-surface-2">
                  {asc.map((l) => (
                    <div key={l.id} className="absolute inset-y-0 flex items-center justify-center overflow-hidden text-v2-caption font-semibold text-white" style={{ left: `${l.min}%`, width: `${Math.max(0, l.max - l.min + 1)}%`, background: l.color }} title={`${l.name}: ${l.min}–${l.max}%`}>
                      <span className="truncate px-1">{l.name}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-v2-caption tabular-nums text-v2-text-3">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </>
            )}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-v2-small">
                <thead>
                  <tr className="border-b border-v2-border">
                    <th className={TH}>{t("Daraja")}</th>
                    <th className={`${TH} text-right`}>{t("Minimal")}</th>
                    <th className={`${TH} text-right`}>{t("Maksimal")}</th>
                    <th className={TH}>{t("Rang")}</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-v2-border">
                  {levels.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2 font-semibold text-v2-text">
                          <span className="size-2.5 rounded-full" style={{ background: l.color }} aria-hidden /> {l.name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-v2-text">{l.min}%</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-v2-text">{l.max}%</td>
                      <td className="py-2.5 pr-3 text-v2-text-2">{t(colorName(l.color)) || l.color}</td>
                      <td className="py-1.5">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => setForm({ id: l.id, name: l.name, min: String(l.min), max: String(l.max), color: l.color })} aria-label={t("Tahrirlash")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                            <Pencil className="size-4" aria-hidden />
                          </button>
                          <button type="button" onClick={() => setDel(l)} aria-label={t("O'chirish")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                            <X className="size-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!levels.length && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-v2-text-3">{t("Daraja qo'shilmagan")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {levels.length > 0 &&
              (cov.gaps.length || cov.overlaps.length ? (
                <div className="mt-3 flex gap-2 rounded-v2-md bg-v2-warning-bg p-3 text-v2-small font-semibold text-v2-warning">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {cov.gaps.length > 0 && t("Qoplanmagan: {g}", { g: cov.gaps.join(", ") })} {cov.overlaps.length > 0 && t("Ustma-ust: {o}", { o: cov.overlaps.join(", ") })}
                  </span>
                </div>
              ) : (
                <div className="mt-3 flex gap-2 rounded-v2-md bg-v2-success-bg p-3 text-v2-small font-semibold text-v2-success">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("0–100% to'liq qoplangan · oraliqlar ustma-ust tushmaydi")}
                </div>
              ))}
          </section>
          {form && (
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
              <h2 className="font-semibold text-v2-text">{form.id ? t("Darajani tahrirlash") : t("Daraja qo'shish")}</h2>
              <p className="text-v2-small text-v2-text-2">{t("Rang — tayyor ranglardan: ikkala temada ham o'qiladi")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_110px]">
                <label className="text-v2-small font-medium text-v2-text">
                  {t("Nomi")}
                  <TextInput className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} placeholder={t("Masalan: Olimpiadachi")} />
                </label>
                <label className="text-v2-small font-medium text-v2-text">
                  {t("Minimal foiz")}
                  <TextInput className="mt-1" inputMode="numeric" value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
                </label>
                <label className="text-v2-small font-medium text-v2-text">
                  {t("Maksimal foiz")}
                  <TextInput className="mt-1" inputMode="numeric" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
                </label>
              </div>
              <div className="mt-3 text-v2-small font-medium text-v2-text">{t("Rangi")}</div>
              <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label={t("Rangi")}>
                {PALETTE.map((p) => (
                  <button key={p.hex} type="button" role="radio" aria-checked={form.color === p.hex} aria-label={t(p.name)} onClick={() => setForm({ ...form, color: p.hex })} className={`size-8 rounded-full ring-offset-2 ring-offset-v2-surface ${form.color === p.hex ? "ring-2 ring-v2-text" : ""}`} style={{ background: p.hex }} />
                ))}
              </div>
              {(formErr || clash) && form.name && (
                <div className="mt-3 flex gap-2 rounded-v2-md bg-v2-warning-bg p-3 text-v2-small font-semibold text-v2-warning">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {formErr || t("{a}–{b}% «{n}» bilan ustma-ust tushadi — avval uning oralig'ini o'zgartiring", { a: fMin, b: fMax, n: clash?.name ?? "" })}
                </div>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setForm(null)} className={secondaryBtn}>
                  {t("Bekor qilish")}
                </button>
                <button type="button" disabled={busy || !!formErr || !!clash} onClick={() => void submit()} className={`${primaryBtn} disabled:opacity-50`}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} {form.id ? t("Saqlash") : t("Qo'shish")}
                </button>
              </div>
            </section>
          )}
        </div>
        <div className="space-y-4">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Natijada shunday ko'rinadi")}</h2>
            <p className="text-v2-small text-v2-text-2">{t("namuna foizlar bilan")}</p>
            <ul className="mt-2 divide-y divide-v2-border">
              {sample.map((p) => {
                const l = levelOf(p);
                return (
                  <li key={p} className="flex items-center justify-between py-2 text-v2-small">
                    <span className="text-v2-text-2">{t("O'quvchi")}</span>
                    <span className="rounded-full px-2 py-0.5 text-v2-caption font-semibold text-white" style={{ background: l?.color ?? "#94a3b8" }}>
                      {p}% · {l?.name ?? t("darajasiz")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Qayerda ko'rinadi")}</h2>
            <ul className="mt-2 space-y-2 text-v2-small">
              {[
                [t("Imtihon → Sarhisob"), t("har o'quvchi foizi yonida daraja")],
                [t("O'quvchi kabineti → Natijalar"), t("o'quvchi va ota-ona ko'radi")],
              ].map(([a, b]) => (
                <li key={a} className="flex items-start justify-between gap-2">
                  <span>
                    <span className="block font-semibold text-v2-text">{a}</span>
                    <span className="block text-v2-text-2">{b}</span>
                  </span>
                  <span className="shrink-0 rounded-v2-sm bg-v2-info-bg px-1.5 text-v2-caption font-semibold text-v2-info">{t("Tez orada")}</span>
                </li>
              ))}
            </ul>
            <Link href="/seasonal-assessment" className="mt-3 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
              {t("Mavsumiy baholash mezonlari")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>
        </div>
      </div>
      {del && <V2Confirm title={t("Darajani o'chirasizmi?")} body={t("«{n}» ro'yxatdan olib tashlanadi.", { n: del.name })} confirmLabel={t("O'chirish")} onConfirm={() => void remove(del)} onCancel={() => setDel(null)} />}
    </div>
  );
}
