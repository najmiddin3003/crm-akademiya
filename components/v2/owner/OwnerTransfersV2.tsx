"use client";

import { useState } from "react";
import { Ban, Bell, Check, CheckCircle2, Clock, Download, Send, ShieldAlert, Truck, Wallet } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { AcceptDialog, ReturnDialog } from "@/components/v2/finance/DailyHandoverV2";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { downloadCsv, NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { Card, CardTitle } from "@/components/v2/teacher/teacherBits";
import type { DailyHandoverPayload, HandoverCard } from "@/lib/dailyHandoverTypes";
import { fmtWait } from "@/components/v2/front/FrontHomeV2";
import { ToBranchDialog } from "./OwnerCashDialogs";
import { BranchDot, Crumbs, nf, Pill } from "./ownerBits";

// YANGI VERSIYA — RAHBAR PANELI · KO'CHIRMALAR (48-qism, rasmlar «Rahbar paneli · ko'chirmalar», «Ko'chirmani sanab
// qabul qilish»). 32-qismdagi «Kunlik topshiruv»ning qabul tomoni: 4 ko'rsatkich (yo'lda, filial kassalarida, 2+ kun
// topshirilmagan, oyda qabul qilingan), kutilayotgan va topshiriladigan kassalar (Sanab qabul qilish / Eslatish),
// «Rahbar kassasidan filialga», qoidalar, oy tarixi. Qabul oynasi — mavjud (components/v2/finance/DailyHandoverV2).
// Server — /api/owner?view=transfers (lib/ownerPanel.ts → lib/dailyHandover.ts).

type Data = DailyHandoverPayload & {
  kpi: { transit: number; transitCount: number; transitFrom: string; branchTotal: number; branchCount: number; stale: number; staleCount: number; monthTotal: number; monthCount: number; monthDiff: number };
  outgoing: { id: number; to: string; owner: string; amount: number; method: string; date: string; time: string; note: string; waiting: boolean; takenBy: string }[];
};

function minutesSince(date: string, time: string, today: string, now: string): number {
  const a = Date.parse(`${date}T${time || "00:00"}:00Z`);
  const b = Date.parse(`${today}T${now}:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 60000)) : 0;
}

export default function OwnerTransfersV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [box, setBox] = useState("");
  const [acceptFor, setAcceptFor] = useState<HandoverCard | null>(null);
  const [returnFor, setReturnFor] = useState<HandoverCard | null>(null);
  const [giving, setGiving] = useState(false);
  const { data, error, reload } = useReportData<Data>("/api/owner?view=transfers");

  if (error) return <NoticeBar>{t("Ma'lumotni yuklab bo'lmadi")}</NoticeBar>;
  if (!data) return <div className="h-96 animate-pulse rounded-v2-lg bg-v2-skeleton" />;
  const d = data;
  const k = d.kpi;
  const daysSince = (iso: string) => Math.round((Date.parse(`${d.today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86400_000);
  const cards = d.cards.filter((c) => (c.pending || c.total > 0) && (!box || String(c.cashboxId) === box));
  const records = d.records.filter((r) => !box || String(r.cashboxId) === box);
  const outs = d.outgoing.filter((o) => o.waiting || o.date.startsWith(d.month));

  async function post(body: Record<string, unknown>) {
    const r = await fetch("/api/cashboxes/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) showError(t(r?.error || "Saqlab bo'lmadi"));
    return r;
  }
  async function remind(c: HandoverCard) {
    const r = await post({ action: "remind", cashboxId: c.cashboxId });
    if (!r?.ok) return;
    if (Number(r.sent) > 0) showSuccess(t("{name} ga eslatma yuborildi", { name: c.moderator || c.name }));
    else showError(t("Eslatma ketmadi — kassa egasi xodimlar botiga ulanmagan"));
  }
  function exportCsv() {
    downloadCsv(
      `kochirmalar-${d.month}.csv`,
      [t("Sana"), t("Vaqt"), t("Filial kassasi"), t("Mas'ul"), t("Naqd"), t("Plastik"), t("Jami"), t("Farq"), t("Qabul qildi"), t("Izoh")],
      records.map((r) => [r.date, r.time, r.cashboxName, r.moderator, r.naqd, r.plastik, r.total, r.diff, r.acceptedBy, r.note]),
    );
  }
  const ctx = {
    primaryId: d.primary.id,
    methods: {},
    methodNames: d.methodNames,
    branches: d.cards.map((c) => ({ cashboxId: c.cashboxId, name: c.name, owner: c.moderator, total: c.total, pending: c.pending?.total ?? 0, days: c.last ? daysSince(c.last.date) : null })),
  };

  const KPIS = [
    { Icon: Truck, tone: "bg-v2-info-bg text-v2-info", value: nf(k.transit), valTone: "text-v2-info", label: k.transitCount ? t("Yo'lda · {n} ta · {from}", { n: k.transitCount, from: k.transitFrom }) : t("Yo'lda hech narsa yo'q") },
    { Icon: Wallet, tone: "bg-v2-surface-2 text-v2-text-2", value: nf(k.branchTotal), valTone: "text-v2-text", label: t("Filial kassalarida · {n} ta", { n: k.branchCount }) },
    { Icon: Clock, tone: "bg-v2-warning-bg text-v2-warning", value: nf(k.stale), valTone: k.stale ? "text-v2-warning" : "text-v2-text", label: t("2+ kun topshirilmagan · {n} kassa", { n: k.staleCount }) },
    { Icon: CheckCircle2, tone: "bg-v2-success-bg text-v2-success", value: nf(k.monthTotal), valTone: "text-v2-text", label: t("{m}da qabul qilindi · {n} ta · farq {d}", { m: fmt.monthName(d.month), n: k.monthCount, d: nf(k.monthDiff) }) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Crumbs here="Ko'chirmalar" />
          <h1 className="text-v2-page text-v2-text">{t("Ko'chirmalar")}</h1>
          <p className="text-v2-small text-v2-text-2">
            {t("Filial kassalaridan Rahbar kassasiga va Rahbar kassasidan filialga")} · {fmt.dayMonth(d.today)} | {d.now}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className={secondaryBtn}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Hisobot")}
          </button>
          <button type="button" onClick={() => setGiving(true)} className={secondaryBtn}>
            <Send className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Filialga pul berish")}
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm lg:grid-cols-4" style={{ gap: 1 }}>
        {KPIS.map((x, i) => (
          <div key={i} className="flex items-center gap-3 bg-v2-surface px-3 py-3 sm:px-4 sm:py-4">
            <span className={`hidden size-10 shrink-0 place-items-center rounded-v2-md sm:grid ${x.tone}`}>
              <x.Icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <div className={`text-[1.375rem] font-semibold leading-7 tabular-nums ${x.valTone}`}>{x.value}</div>
              <div className="text-v2-caption text-v2-text-2">{x.label}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <Card className="!p-0 sm:!p-0">
          <div className="flex flex-wrap items-start justify-between gap-2 p-4 sm:p-5">
            <div>
              <h2 className="text-v2-section text-v2-text">{t("Kutilayotgan va topshiriladigan · {n}", { n: cards.length })}</h2>
              <p className="text-v2-small text-v2-text-3">{fmt.dayMonth(d.today)} | {t("{t} holati", { t: d.now })}</p>
            </div>
            <V2Select variant="chip" label={t("Filial")} value={box} onChange={setBox} options={d.cards.map((c) => ({ value: String(c.cashboxId), label: c.name }))} />
          </div>
          {cards.length === 0 ? <p className="border-t border-v2-border px-5 py-8 text-center text-v2-small text-v2-success">{t("Hamma kassa topshirilgan.")}</p> : null}
          {cards.map((c) => {
            const p = c.pending;
            const amount = p ? p.total : c.total;
            const methods = p ? p.methods : c.methods;
            const lastDays = c.last ? daysSince(c.last.date) : null;
            const idx = d.cards.findIndex((x) => x.cashboxId === c.cashboxId) + 1;
            return (
              <div key={c.cashboxId} className="grid grid-cols-[minmax(0,1fr)] gap-3 border-t border-v2-border px-4 py-3.5 sm:px-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <BranchDot n={idx} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-v2-body font-semibold text-v2-text">{c.name}</span>
                      <b className="shrink-0 tabular-nums text-v2-text">{nf(amount)}</b>
                    </div>
                    <div className="flex justify-between gap-2 text-v2-caption text-v2-text-3">
                      <span className="truncate">{c.moderator || "—"}</span>
                      <span className="shrink-0">{Object.entries(methods).filter(([, v]) => v > 0).map(([mk, v]) => `${(d.methodNames[mk] ?? mk).toLowerCase()} ${nf(v)}`).join(" · ")}</span>
                    </div>
                  </div>
                </div>
                <div className="min-w-0 text-v2-caption text-v2-text-2">
                  {p ? (
                    <>
                      <Pill tone="info">
                        <Truck className="size-3" aria-hidden />
                        {t("Yo'lda · {w}", { w: fmtWait(t, minutesSince(p.date, p.time, d.today, d.now)) })}
                      </Pill>
                      <span className="mt-1 block">{t("Topshirdi {t} · olib keluvchi: {who}", { t: p.date === d.today ? p.time : `${fmt.dayMonth(p.date)} ${p.time}`, who: c.moderator || "—" })}</span>
                    </>
                  ) : (
                    <>
                      <Pill tone={lastDays !== null && lastDays < 2 ? "neutral" : "warning"}>
                        <Clock className="size-3" aria-hidden />
                        {lastDays === null ? t("Hali topshirmagan") : t("{n} kun topshirilmagan", { n: lastDays })}
                      </Pill>
                      {c.last ? <span className="mt-1 block">{t("Oxirgi topshiruv")}: {fmt.dayMonth(c.last.date)} | {c.last.time}{c.last.diff ? ` · ${t("farq")} ${nf(c.last.diff)}` : ""}</span> : null}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {p ? (
                    <>
                      <button type="button" onClick={() => setAcceptFor(c)} className={primaryBtn}>
                        <Check className="size-4" strokeWidth={2} aria-hidden />
                        {t("Sanab qabul qilish")}
                      </button>
                      <button type="button" onClick={() => setReturnFor(c)} className={secondaryBtn}>{t("Qaytarish")}</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => void remind(c)} className={secondaryBtn}>
                        <Bell className="size-4" strokeWidth={1.75} aria-hidden />
                        {t("Eslatish")}
                      </button>
                      <button type="button" onClick={() => setAcceptFor(c)} className={secondaryBtn}>{t("Qabul qilish")}</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-v2-border bg-v2-surface-2 px-4 py-2.5 text-v2-caption text-v2-text-2 sm:px-5">
            <span className="inline-flex items-center gap-1.5"><Bell className="size-3.5" aria-hidden />{t("20:00 gacha topshirilmasa — mas'ulga va sizga eslatma")}</span>
            <span className="inline-flex items-center gap-1.5"><Truck className="size-3.5" aria-hidden />{t("«Yo'lda» 24 soatdan oshsa — ogohlantirish")}</span>
            <span className="inline-flex items-center gap-1.5"><Wallet className="size-3.5" aria-hidden />{t("naqd sanaladi, plastik kartaga tushgani tekshiriladi")}</span>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle title={t("Rahbar kassasidan filialga · {n}", { n: outs.length })} sub={`${fmt.monthLower(d.month)} · ${t("admin «Oldim» bosguncha — yo'lda")}`} />
            </div>
            {outs.length === 0 ? <p className="border-t border-v2-border px-5 py-4 text-v2-small text-v2-text-3">{t("Bu oy filialga pul berilmagan.")}</p> : null}
            {outs.map((o) => (
              <div key={o.id} className="flex items-start gap-3 border-t border-v2-border px-4 py-3 sm:px-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-v2-md bg-v2-info-bg text-v2-info">
                  <Send className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-v2-small font-semibold text-v2-text">→ {o.to}</span>
                  <span className="block text-v2-caption text-v2-text-3">{[o.note, `${fmt.dayMonth(o.date)} | ${o.time}`].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <b className="tabular-nums text-v2-text">{nf(o.amount)}</b>
                  {o.waiting ? <Pill tone="info">{t("yo'lda")}</Pill> : <Pill tone="success">{o.takenBy ? t("{who} oldi", { who: o.takenBy }) : t("olindi")}</Pill>}
                </span>
              </div>
            ))}
            <div className="border-t border-v2-border p-3 sm:px-5">
              <button type="button" onClick={() => setGiving(true)} className={`${secondaryBtn} w-full justify-center`}>
                <Send className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Filialga pul berish")}
              </button>
            </div>
          </Card>
          <Card>
            <h2 className="text-v2-section text-v2-text">{t("Qoidalar")}</h2>
            <ul className="mt-3 space-y-2.5 text-v2-small text-v2-text-2">
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-v2-success" aria-hidden />{t("Filial kassasi → Rahbar kassasi: naqd sanab, plastik tekshirib qabul qilinadi")}</li>
              <li className="flex gap-2"><Send className="mt-0.5 size-4 shrink-0 text-v2-info" aria-hidden />{t("Rahbar kassasi → filial: faqat siz berasiz, admin «Oldim» bilan tasdiqlaydi")}</li>
              <li className="flex gap-2"><Ban className="mt-0.5 size-4 shrink-0 text-v2-danger" aria-hidden />{t("Filiallar o'rtasida pul o'tkazish yo'q")}</li>
              <li className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-v2-warning" aria-hidden />{t("Farq bo'lsa — izoh majburiy; kamomadni jarima qilish ixtiyoriy")}</li>
            </ul>
          </Card>
        </div>
      </div>

      <Card className="!p-0 sm:!p-0">
        <div className="flex flex-wrap items-start justify-between gap-2 p-4 sm:p-5">
          <div>
            <h2 className="text-v2-section text-v2-text">{t("{m}dagi ko'chirmalar · {n} ta", { m: fmt.monthName(d.month), n: records.length })}</h2>
            <p className="text-v2-small text-v2-text-3">{t("qabul qilingan vaqt bo'yicha · eng yangisi tepada")}</p>
          </div>
          <button type="button" onClick={exportCsv} className={secondaryBtn}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-v2-small">
            <thead>
              <tr className="border-y border-v2-border bg-v2-surface-2 text-v2-caption text-v2-text-2">
                <th className="px-4 py-2 text-left font-medium sm:px-5">{t("Qabul qilindi")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("Filial kassasi")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("Qabul qildi")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("Naqd")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("Plastik")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("Jami")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("Farq")}</th>
                <th className="px-4 py-2 text-left font-medium sm:px-5">{t("Holat")}</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-v2-text-3">{t("Bu oyda ko'chirma qabul qilinmagan.")}</td>
                </tr>
              ) : null}
              {records.map((r) => (
                <tr key={r.id} className="border-t border-v2-border">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums sm:px-5">{fmt.dayMonth(r.date)} | {r.time}</td>
                  <td className="px-3 py-2.5">
                    <span className="block font-semibold text-v2-text">{r.cashboxName}</span>
                    <span className="text-v2-caption text-v2-text-3">{r.moderator}</span>
                  </td>
                  <td className="px-3 py-2.5 text-v2-text-2">{r.acceptedBy || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.naqd ? nf(r.naqd) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.plastik ? nf(r.plastik) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{nf(r.total)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${r.diff < 0 ? "text-v2-danger" : "text-v2-text-2"}`}>{r.diff ? nf(r.diff) : 0}</td>
                  <td className="px-4 py-2.5 sm:px-5">
                    {r.diff ? <Pill tone="warning">{t("Farq bilan")}</Pill> : <Pill tone="success">{t("Qabul qilindi")}</Pill>}
                    {r.note ? <span className="mt-0.5 block text-v2-caption text-v2-text-3">{r.note}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {acceptFor ? <AcceptDialog card={acceptFor} data={d} onClose={() => setAcceptFor(null)} onDone={reload} /> : null}
      {returnFor ? (
        <ReturnDialog
          card={returnFor}
          onClose={() => setReturnFor(null)}
          onSubmit={async (comment) => {
            const r = await post({ action: "return", cashboxId: returnFor.cashboxId, comment });
            if (r?.ok) {
              showSuccess(t("Qaytarildi"));
              reload();
            }
            return !!r?.ok;
          }}
        />
      ) : null}
      {giving ? <ToBranchDialog ctx={ctx} onClose={() => setGiving(false)} onDone={reload} /> : null}
    </div>
  );
}
