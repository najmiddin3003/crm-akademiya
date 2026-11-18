"use client";

import { useState } from "react";
import { ArrowRight, Building2, Handshake, Info, Loader2, Plus } from "lucide-react";
import Link from "@/components/ui/Link";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, MoneyField, TextInput } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { Avatar, NoticeBar, TH, fmtNum, fmtPhone } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";

// YANGI VERSIYA — SOZLAMALAR → MOLIYA → «HAMKORLAR VA 3-SHAXSLAR» (39-qism, rasm «Sozlamalar · Hamkorlar»).
// Hamkorlar ulushi (yig'indi 100% bo'lishi kerak) va o'tgan oy sof foydasidan ulushi; 3-shaxslar ro'yxati.
// Qo'shish oynasi umumiy /api/settings-lists ga yozadi (eski tablar bilan bir ro'yxat); tahrirlash/o'chirish —
// eski tabda. Server: /api/partners-overview (lib/partnersPage.ts).

type Data = {
  ok: true;
  month: string;
  income: number;
  expense: number;
  profit: number;
  partners: { id: number; name: string; phone: string; share: number; amount: number }[];
  shareSum: number;
  thirds: { id: number; name: string; phone: string; balance: number }[];
};

function AddDialog({ kind, left, onClose, onDone }: { kind: "partners" | "third-persons"; left: number; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess } = useToast();
  const modal = useModalClose(onClose, "center");
  const partner = kind === "partners";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [share, setShare] = useState(partner && left > 0 ? String(left) : "");
  const [balance, setBalance] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!name.trim()) return setErr(t("Nomini kiriting"));
    if (partner && !(Number(share) > 0 && Number(share) <= 100)) return setErr(t("Ulush 1–100%"));
    setSaving(true);
    const body = partner ? { name: name.trim(), phone: phone.trim(), share: `${Number(share)}%` } : { name: name.trim(), phone: phone.trim(), balance: balance || "0" };
    const r = await fetch(`/api/settings-lists?kind=${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!r?.ok) return setErr(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Qo'shildi"));
    onDone();
    modal.close();
  }
  return (
    <V2Dialog
      title={partner ? t("Hamkor qo'shish") : t("3-shaxs qo'shish")}
      subtitle={partner ? t("Markaz foydasidan ulush oladi") : t("Markaz pul to'laydigan yoki pul oladigan tashqi tomon")}
      onClose={onClose}
      controller={modal}
      dirty={!!name || !!phone}
      saving={saving}
      onSubmit={() => void submit()}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("Qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={partner ? t("To'liq ismi") : t("Nomi")} htmlFor="pt-name" error={err || undefined}>
          <TextInput id="pt-name" value={name} onChange={(e) => (setName(e.target.value), setErr(""))} maxLength={80} placeholder={partner ? "" : t("Masalan: Bino egasi")} autoComplete="off" />
        </Field>
        <Field label={t("Telefon raqam")} optional htmlFor="pt-phone">
          <TextInput id="pt-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" autoComplete="off" />
        </Field>
        {partner ? (
          <Field label={t("Ulush, %")} htmlFor="pt-share" hint={t("Qolgan ulush: {n}%", { n: Math.max(0, left) })}>
            <TextInput id="pt-share" value={share} onChange={(e) => (setShare(e.target.value.replace(/\D/g, "").slice(0, 3)), setErr(""))} inputMode="numeric" />
          </Field>
        ) : (
          <Field label={t("Balans")} optional htmlFor="pt-bal">
            <MoneyField id="pt-bal" compact value={balance} onChange={setBalance} />
          </Field>
        )}
      </div>
    </V2Dialog>
  );
}

export default function PartnersV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { data: d, error, reload } = useReportData<Data>("/api/partners-overview");
  const [add, setAdd] = useState<"partners" | "third-persons" | null>(null);
  if (error) return <div className="p-6"><NoticeBar>{t("Faqat direktor uchun")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const sumOk = d.partners.length > 0 && Math.round(d.shareSum) === 100;
  const monthN = fmt.monthName(d.month);
  const margin = d.income > 0 ? Math.round((d.profit / d.income) * 100) : null;
  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-v2-small text-v2-text-2">{t("Moliya")}</div>
          <h1 className="text-v2-page text-v2-text">{t("Hamkorlar va 3-shaxslar")}</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("Hamkor — markaz foydasidan ulush oladi. 3-shaxs — markaz pul to'laydigan yoki pul oladigan tashqi tomon: bino egasi, kommunal, provayder.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAdd("partners")} className={secondaryBtn}>
            <Plus className="size-4" aria-hidden /> {t("Hamkor qo'shish")}
          </button>
          <button type="button" onClick={() => setAdd("third-persons")} className={primaryBtn}>
            <Plus className="size-4" aria-hidden /> {t("3-shaxs qo'shish")}
          </button>
        </div>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand">
                <Handshake className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-v2-text">{t("Hamkorlar")}</h2>
                <p className="text-v2-small text-v2-text-2">{t("Ulushlar yig'indisi 100% bo'lishi shart")}</p>
              </div>
              {d.partners.length > 0 && <span className={`rounded-full px-2 py-0.5 text-v2-caption font-semibold ${sumOk ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}>{t("Jami {n}%", { n: d.shareSum })}</span>}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-v2-surface-2">
              <div className={`h-full rounded-full ${sumOk ? "bg-v2-brand" : "bg-v2-warning"}`} style={{ width: `${Math.min(100, d.shareSum)}%` }} />
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[440px] text-v2-small">
                <thead>
                  <tr className="border-b border-v2-border">
                    <th className={TH}>{t("Hamkor")}</th>
                    <th className={`${TH} text-right`}>{t("Ulush")}</th>
                    <th className={`${TH} text-right`}>{t("{m} ulushi", { m: monthN })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-v2-border">
                  {d.partners.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={p.name} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-v2-text">{p.name}</div>
                            {p.phone && <div className="text-v2-caption text-v2-text-2">{fmtPhone(p.phone)}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-v2-text">{p.share}%</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-v2-text">{fmtNum(p.amount)}</td>
                    </tr>
                  ))}
                  {!d.partners.length && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-v2-text-3">{t("Hamkor qo'shilmagan")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!sumOk && d.partners.length > 0 && <div className="mt-2"><NoticeBar>{t("Ulushlar yig'indisi {n}% — 100% bo'lishi kerak. Eski tabda tahrirlang.", { n: d.shareSum })}</NoticeBar></div>}
            <div className="mt-3 flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Ulush o'tgan oy sof foydasidan ko'rsatish uchun hisoblanadi. Ulush to'lovi kassadan chiqim bilan alohida yoziladi.")}
            </div>
            <Link href="/settings-finance?tab=partners" className="mt-2 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
              {t("Tahrirlash")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-info-bg text-v2-info">
                <Building2 className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-v2-text">
                  {t("3-shaxslar")} · {d.thirds.length}
                </h2>
                <p className="text-v2-small text-v2-text-2">{t("Bino egasi, kommunal, provayderlar. Kassa amallariga bog'lash tez orada.")}</p>
              </div>
            </div>
            <ul className="mt-2 divide-y divide-v2-border">
              {d.thirds.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={x.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-v2-text">{x.name}</div>
                    {x.phone && <div className="text-v2-caption text-v2-text-2">{fmtPhone(x.phone)}</div>}
                  </div>
                  <span className={`tabular-nums ${x.balance ? "font-semibold text-v2-text" : "text-v2-text-3"}`}>{fmtNum(x.balance)}</span>
                </li>
              ))}
              {!d.thirds.length && <li className="py-6 text-center text-v2-small text-v2-text-3">{t("3-shaxs qo'shilmagan")}</li>}
            </ul>
            <Link href="/settings-finance?tab=third-persons" className="mt-2 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
              {t("Tahrirlash")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>
        </div>
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
          <h2 className="font-semibold text-v2-text">{t("{m} foydasi", { m: monthN })}</h2>
          <p className="text-v2-small text-v2-text-2">{t("Kassa amallari bo'yicha")}</p>
          <div className="mt-2 divide-y divide-v2-border text-v2-small">
            <div className="flex justify-between py-2">
              <span className="text-v2-text-2">{t("Jami daromad")}</span>
              <span className="font-semibold tabular-nums text-v2-text">{fmtNum(d.income)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-v2-text-2">{t("Jami xarajat")}</span>
              <span className="font-semibold tabular-nums text-v2-danger">{d.expense ? `−${fmtNum(d.expense)}` : "0"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-v2-text-2">
                {t("Sof foyda")}
                {margin !== null ? ` · ${margin}%` : ""}
              </span>
              <span className={`font-semibold tabular-nums ${d.profit >= 0 ? "text-v2-success" : "text-v2-danger"}`}>{fmtNum(d.profit)}</span>
            </div>
          </div>
          <Link href="/finance-revenue-plan?tab=pnl" className="mt-2 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
            {t("Foyda va zarar")} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </section>
      </div>
      {add && <AddDialog kind={add} left={100 - d.shareSum} onClose={() => setAdd(null)} onDone={reload} />}
    </div>
  );
}
