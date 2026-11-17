"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, Segmented, TextInput } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, SegmentPills, TH } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { HOLIDAY_KINDS, type HolidayKind, type HolidayRow, type HolidaysPayload } from "@/lib/holidayTypes";

// YANGI VERSIYA — SOZLAMALAR → «ISH KUNLARI VA BAYRAMLAR» (37-qism, rasmlar «Bayramlar», «Bayram qo'shish»).
// Ish haftasi (kunlar, dars vaqti, toq/juft guruhlar), o'quv yili dam olish kunlari (Kelayotgan / O'tgan / Hammasi):
// sana, nomi + turi, qamrov, darsi o'tmaydigan guruhlar; o'ngda tanlangan kun — filiallar bo'yicha, o'quvchilar,
// «Shu kuni tizim», ota-onalarga bot orqali xabar. Server: /api/holidays (lib/holidays.ts).

type Tab = "next" | "past" | "all";
const KIND_CLS: Record<HolidayKind, string> = { davlat: "bg-v2-brand-bg text-v2-brand", diniy: "bg-v2-warning-bg text-v2-warning", markaz: "bg-v2-violet-bg text-v2-violet" };
const WD = [
  [1, "Du"],
  [2, "Se"],
  [3, "Ch"],
  [4, "Pa"],
  [5, "Ju"],
  [6, "Sh"],
  [0, "Ya"],
] as const;
const WD_FULL = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dateOf = (s: string) => new Date(`${s}T00:00:00`);

async function api(body: Record<string, unknown>) {
  return fetch("/api/holidays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((x) => x.json())
    .catch(() => null);
}

export default function HolidaysV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<HolidaysPayload>("/api/holidays");
  const [tab, setTab] = useState<Tab>("next");
  const [sel, setSel] = useState<number | null>(null);
  const [edit, setEdit] = useState<HolidayRow | "new" | null>(null);
  const [del, setDel] = useState<HolidayRow | null>(null);
  const rows = (d?.rows ?? []).filter((r) => (tab === "all" ? true : tab === "next" ? r.to >= d!.today : r.to < d!.today));
  const cur = rows.find((r) => r.id === sel) ?? rows[0] ?? null;
  const range = (r: HolidayRow) => (r.from === r.to ? fmt.dayMonth(r.from) : `${fmt.dayMonth(r.from)} – ${fmt.dayMonth(r.to)}`);

  async function toggleDay(day: number) {
    if (!d) return;
    const days = d.week.days.includes(day) ? d.week.days.filter((x) => x !== day) : [...d.week.days, day];
    const r = await api({ action: "week", days });
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    reload();
  }
  async function notify(r: HolidayRow) {
    const res = await api({ action: "notify", id: r.id });
    if (!res?.ok) return showError(t(res?.error || "Yuborib bo'lmadi"));
    showSuccess(t("{n} ta xabar yuborildi ({p} o'quvchi)", { n: res.sent, p: res.pupils }));
    reload();
  }

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-v2-small text-v2-text-2">{t("Umumiy")}</div>
          <h1 className="text-v2-page text-v2-text">{t("Ish kunlari va bayramlar")}</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("Dam olish kuni darslar o'tmaydi, davomat so'ralmaydi, ota-onalarga oldindan xabar ketadi. Oylik to'lov o'zgarmaydi.")}</p>
        </div>
        <button type="button" onClick={() => setEdit("new")} className={primaryBtn}>
          <Plus className="size-4" aria-hidden /> {t("Kun qo'shish")}
        </button>
      </div>
      {error && <NoticeBar>{t("Ma'lumot olinmadi")}</NoticeBar>}
      {!d && !error && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}
      {d && (
        <>
          <section className="flex flex-wrap items-center gap-4 rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <div>
              <div className="font-semibold text-v2-text">{t("Ish haftasi")}</div>
              <div className="text-v2-small text-v2-text-2">{t("dars vaqti {a}–{b}", { a: d.week.from, b: d.week.to })}</div>
            </div>
            <div className="flex gap-1.5" role="group" aria-label={t("Ish haftasi")}>
              {WD.map(([n, l]) => {
                const on = d.week.days.includes(n);
                return (
                  <button key={n} type="button" aria-pressed={on} onClick={() => void toggleDay(n)} className={`size-9 rounded-v2-md border text-v2-small font-semibold ${on ? "border-v2-brand bg-v2-brand-bg text-v2-brand" : "border-v2-border text-v2-text-3"}`}>
                    {t(l)}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto text-right text-v2-small text-v2-text-2">
              <div>
                <b className="text-v2-text">{t("Toq kunlar")}</b> {t("Du·Ch·Ju — {n} guruh", { n: d.oddGroups })}
              </div>
              <div>
                <b className="text-v2-text">{t("Juft kunlar")}</b> {t("Se·Pa·Sh — {n} guruh", { n: d.evenGroups })}
              </div>
            </div>
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <h2 className="font-semibold text-v2-text">{t("{y} o'quv yili", { y: d.year })}</h2>
                  <p className="text-v2-small text-v2-text-2">{t("Sanasi o'zgarmaydigan davlat bayramlari har yil o'zi qo'shiladi")}</p>
                </div>
                <SegmentPills<Tab>
                  items={[
                    { key: "next", label: t("Kelayotgan"), count: d.rows.filter((r) => r.to >= d.today).length },
                    { key: "past", label: t("O'tgan"), count: d.rows.filter((r) => r.to < d.today).length },
                    { key: "all", label: t("Hammasi"), count: d.rows.length },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
              </div>
              <div className="overflow-x-auto border-t border-v2-border">
                <table className="w-full min-w-[640px] border-collapse text-v2-body">
                  <thead>
                    <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                      <th className={`${TH} pl-4`}>{t("Sana")}</th>
                      <th className={TH}>{t("Nomi")}</th>
                      <th className={TH}>{t("Qamrov")}</th>
                      <th className={`${TH} pr-4`}>{t("Darslar")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} onClick={() => setSel(r.id)} className={`cursor-pointer border-b border-v2-border last:border-b-0 hover:bg-v2-hover ${cur?.id === r.id ? "bg-v2-brand-bg shadow-[inset_3px_0_0_var(--color-v2-brand)]" : ""}`}>
                        <td className="py-2.5 pl-4 pr-3">
                          <div className="font-semibold tabular-nums text-v2-text">{range(r)}</div>
                          <div className="text-v2-small text-v2-text-2">{r.days > 1 ? t("{n} kun", { n: r.days }) : t(WD_FULL[dateOf(r.from).getDay()])}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-v2-text">{r.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-v2-caption font-semibold ${KIND_CLS[r.kind]}`}>{t(HOLIDAY_KINDS.find((k) => k.value === r.kind)?.label ?? "")}</span>
                            {r.approx && <span className="text-v2-caption text-v2-warning">{t("sana taxminiy")}</span>}
                          </div>
                        </td>
                        <td className={`px-3 py-2.5 ${r.branchIds ? "font-semibold text-v2-text" : "text-v2-text-2"}`}>{r.branchIds ? d.branches.filter((b) => r.branchIds!.includes(b.id)).map((b) => b.name).join(", ") || "—" : t("Barcha filiallar")}</td>
                        <td className="py-2.5 pl-3 pr-4">
                          <div className={r.groups ? "font-semibold text-v2-text" : "text-v2-text-3"}>{r.groups ? t("{n} guruh", { n: r.groups }) : "—"}</div>
                          <div className="text-v2-small text-v2-text-2">{r.groups ? (r.lessons > r.groups ? t("{n} dars o'tmaydi", { n: r.lessons }) : t("o'tmaydi")) : t("dars yo'q kun")}</div>
                        </td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-v2-small text-v2-text-3">
                          {t("Dam olish kuni yo'q")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {cur && (
              <aside className="space-y-4 rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                <div>
                  <div className="text-v2-small text-v2-text-2">{t("Tanlangan kun")}</div>
                  <div className="text-[18px] font-semibold text-v2-text">{range(cur)}</div>
                  <div className="flex flex-wrap items-center gap-2 text-v2-small text-v2-text-2">
                    {cur.name} <span className={`rounded-full px-2 py-0.5 text-v2-caption font-semibold ${KIND_CLS[cur.kind]}`}>{t(HOLIDAY_KINDS.find((k) => k.value === cur.kind)?.label ?? "")}</span>
                  </div>
                </div>
                <dl className="space-y-2 rounded-v2-md border border-v2-border bg-v2-surface-2 p-3 text-v2-small">
                  <div className="flex justify-between gap-3">
                    <dt className="text-v2-text-2">{t("Darsi o'tmaydi")}</dt>
                    <dd className="font-semibold text-v2-text">{t("{n} guruh", { n: cur.groups })}</dd>
                  </div>
                  {cur.byBranch.length > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-v2-text-2">{t("Filiallar")}</dt>
                      <dd className="text-right font-semibold text-v2-text">{cur.byBranch.map((b) => `${b.name} — ${b.groups}`).join(" · ")}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-v2-text-2">{t("O'quvchilar")}</dt>
                    <dd className="font-semibold text-v2-text">{t("{n} ta", { n: cur.pupils })}</dd>
                  </div>
                </dl>
                <div>
                  <div className="mb-1.5 text-v2-small font-semibold text-v2-text">{t("Shu kuni tizim")}</div>
                  <ul className="space-y-1.5 text-v2-small text-v2-text-2">
                    {[t("Davomat so'ramaydi — «Davomat nazorati»da belgilanmagan dars bo'lib chiqmaydi"), t("Oylik to'lovni o'zgartirmaydi")].map((x) => (
                      <li key={x} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-v2-success" aria-hidden /> {x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-v2-md border border-v2-border p-3">
                  <div className="font-semibold text-v2-text">{t("Ota-onalarga xabar")}</div>
                  <p className="text-v2-small text-v2-text-2">{cur.notifiedAt ? t("Yuborilgan: {d} · {n} ta xabar", { d: fmt.dayMonth(cur.notifiedAt.slice(0, 10)), n: cur.notifiedCount ?? 0 }) : t("Botga ulangan ota-ona va o'quvchilarga «darslar bo'lmaydi» xabari")}</p>
                  {cur.to >= d.today && cur.groups > 0 && (
                    <button type="button" onClick={() => void notify(cur)} className={`${secondaryBtn} mt-2`}>
                      <Send className="size-4" aria-hidden /> {cur.notifiedAt ? t("Qayta yuborish") : t("Hozir yuborish")}
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEdit(cur)} className={secondaryBtn}>
                    <Pencil className="size-4" aria-hidden /> {t("Tahrirlash")}
                  </button>
                  <button type="button" onClick={() => setDel(cur)} className={`${secondaryBtn} border-transparent text-v2-danger shadow-none`}>
                    <Trash2 className="size-4" aria-hidden /> {t("O'chirish")}
                  </button>
                </div>
              </aside>
            )}
          </div>
        </>
      )}
      {edit && d && <HolidayDialog row={edit === "new" ? null : edit} branches={d.branches} onClose={() => setEdit(null)} onDone={reload} />}
      {del && (
        <V2Confirm
          title={t("Dam olish kunini o'chirish")}
          body={t("«{n}» o'chiriladi — shu kunlarda darslar odatdagidek kutiladi.", { n: del.name })}
          confirmLabel={t("O'chirish")}
          onConfirm={async () => {
            const id = del.id;
            setDel(null);
            const r = await api({ id, delete: true });
            if (!r?.ok) return showError(t("O'chirib bo'lmadi"));
            showSuccess(t("O'chirildi"));
            reload();
          }}
          onCancel={() => setDel(null)}
        />
      )}
    </div>
  );
}

function HolidayDialog({ row, branches, onClose, onDone }: { row: HolidayRow | null; branches: { id: number; name: string }[]; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(row?.name ?? "");
  const [from, setFrom] = useState<Date | null>(row ? dateOf(row.from) : null);
  const [to, setTo] = useState<Date | null>(row ? dateOf(row.to) : null);
  const [kind, setKind] = useState<string>(row?.kind ?? "markaz");
  const [scope, setScope] = useState(row?.branchIds ? "some" : "all");
  const [bids, setBids] = useState<number[]>(row?.branchIds ?? []);
  const [approx, setApprox] = useState(row?.approx ?? false);
  const [notifyP, setNotifyP] = useState(row?.notifyParents ?? true);
  const [busy, setBusy] = useState(false);
  async function save(close: () => void) {
    if (!name.trim()) return showError(t("Nomini yozing"));
    if (!from) return showError(t("Sanani tanlang"));
    setBusy(true);
    const r = await api({ ...(row ? { id: row.id } : {}), name, from: iso(from), to: iso(to ?? from), kind, approx, notifyParents: notifyP, branchIds: scope === "some" ? bids : null });
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(row ? t("Saqlandi") : t("Dam olish kuni qo'shildi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={row ? t("Dam olish kunini tahrirlash") : t("Dam olish kuni qo'shish")}
      subtitle={t("Bayram, ta'mir yoki markaz qarori bilan dam olish")}
      onClose={onClose}
      saving={busy}
      width={560}
      footer={(api2) => (
        <>
          <button type="button" onClick={api2.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api2.close)} disabled={busy} className={primaryBtn}>
            {row ? t("Saqlash") : (
              <>
                <Plus className="size-4" aria-hidden /> {t("Kunni qo'shish")}
              </>
            )}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Masalan: Elektr tarmog'i ta'miri")} maxLength={80} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Boshlanishi")}>
            <V2DateField value={from} onChange={(v) => (setFrom(v), (!to || v > to) && setTo(v))} />
          </Field>
          <Field label={t("Tugashi")}>
            <V2DateField value={to} onChange={setTo} />
          </Field>
        </div>
        <Field label={t("Turi")}>
          <V2Select label={t("Turi")} value={kind} onChange={setKind} options={HOLIDAY_KINDS.map((k) => ({ value: k.value, label: t(k.label) }))} searchable={false} />
        </Field>
        {branches.length > 1 && (
          <Field label={t("Qaysi filiallarda")}>
            <Segmented
              label={t("Qaysi filiallarda")}
              value={scope}
              onChange={setScope}
              options={[
                { value: "all", label: t("Barcha filiallar") },
                { value: "some", label: t("Tanlanganlarda") },
              ]}
            />
            {scope === "some" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {branches.map((b) => {
                  const on = bids.includes(b.id);
                  return (
                    <button key={b.id} type="button" aria-pressed={on} onClick={() => setBids((x) => (on ? x.filter((y) => y !== b.id) : [...x, b.id]))} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-v2-small ${on ? "border-v2-brand bg-v2-brand-bg font-semibold text-v2-brand" : "border-v2-border text-v2-text"}`}>
                      {on && <Check className="size-3.5" aria-hidden />} {b.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        )}
        <label className="flex items-center gap-2 text-v2-small text-v2-text">
          <V2Checkbox checked={approx} onChange={setApprox} label={t("Sana taxminiy")} /> {t("Sana taxminiy (diniy bayram — rasman e'lon qilinadi)")}
        </label>
        <label className="flex items-center gap-2 text-v2-small text-v2-text">
          <V2Checkbox checked={notifyP} onChange={setNotifyP} label={t("Ota-onalarga xabar")} /> {t("Ota-onalarga xabar yuborish kerak (sahifadagi «Hozir yuborish»)")}
        </label>
      </div>
    </V2Dialog>
  );
}
