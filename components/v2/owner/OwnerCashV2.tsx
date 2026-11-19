"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronLeft, ChevronRight, Crown, Download, Eye, EyeOff, HandCoins, History, Lock, PiggyBank, Printer, Send, Truck, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import CashOperationModalV2 from "@/components/v2/finance/CashOperationModalV2";
import { openReceipt } from "@/components/v2/finance/ReceiptHost";
import { methodDot } from "@/components/v2/form/fields";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { downloadCsv, NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { Card, CardTitle } from "@/components/v2/teacher/teacherBits";
import { DividendDialog, SwapDialog, ToBranchDialog, type CashCtx } from "./OwnerCashDialogs";
import { BranchDot, Crumbs, MoneyBar, nf, Pill } from "./ownerBits";

// YANGI VERSIYA — RAHBAR PANELI · RAHBAR KASSASI (48-qism, rasm «Rahbar paneli · Rahbar kassasi»). Bosh kassa
// (`cashboxes.isPrimary`) endi shu yerda: qoldiq to'lov turlari bo'yicha, 6 amal (Kirim, Chiqim, Almashtirish,
// Filialga berish, Dividend, Sarmoya), «Dividend va sarmoya» yil bo'yicha, filial kassalari, amallar jurnali
// (Kirim / Chiqim / Ko'chirma / Almashtirish) — chek tugmasi birinchi ustunda. Server — /api/owner?view=cash.

interface Row {
  id: number;
  kind: string;
  title: string;
  sub: string;
  branch: string;
  amount: number;
  method: string;
  date: string;
  time: string;
  waiting: boolean;
}
interface Data {
  ok: true;
  today: string;
  primary: { id: number; name: string; owner: string; methods: Record<string, number>; total: number; outWaiting: number };
  methodNames: Record<string, string>;
  incoming: { cashboxId: number; name: string; owner: string; amount: number; time: string; date: string }[];
  branches: { cashboxId: number; name: string; owner: string; total: number; pending: number; days: number | null }[];
  outgoing: { id: number; to: string; amount: number; date: string; time: string; note: string }[];
  dividend: { total: number; parts: string[]; lastNote: string };
  sarmoya: { total: number; parts: string[]; lastNote: string };
  counts: Record<string, number>;
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
}

const KIND_ICON: Record<string, { Icon: typeof Wallet; tone: string }> = {
  kirim: { Icon: ArrowDownLeft, tone: "bg-v2-success-bg text-v2-success" },
  chiqim: { Icon: ArrowUpRight, tone: "bg-v2-danger-bg text-v2-danger" },
  kochirma: { Icon: Truck, tone: "bg-v2-info-bg text-v2-info" },
  almashtirish: { Icon: ArrowLeftRight, tone: "bg-v2-violet-bg text-v2-violet" },
  dividend: { Icon: HandCoins, tone: "bg-v2-warning-bg text-v2-warning" },
  sarmoya: { Icon: PiggyBank, tone: "bg-v2-success-bg text-v2-success" },
};

type Modal = null | { kind: "kirim" | "chiqim" } | { kind: "swap" } | { kind: "branch" } | { kind: "dividend" | "sarmoya" };

export default function OwnerCashV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [tab, setTab] = useState("all");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(0);
  const [hide, setHide] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const { data, error, reload } = useReportData<Data>(`/api/owner?view=cash&kind=${tab}&method=${method}&page=${page}`);

  if (error) return <NoticeBar>{t("Ma'lumotni yuklab bo'lmadi")}</NoticeBar>;
  if (!data) return <div className="h-96 animate-pulse rounded-v2-lg bg-v2-skeleton" />;
  const d = data;
  const money = (n: number) => (hide ? "• • •" : nf(n));
  const methods = ["naqd", "plastik", "terminal", "inkassa"];
  const ctx: CashCtx = { primaryId: d.primary.id, methods: d.primary.methods, methodNames: d.methodNames, branches: d.branches };
  const incoming = d.incoming.reduce((a, x) => a + x.amount, 0);
  const pages = Math.max(1, Math.ceil(d.total / d.pageSize));
  const monthFrom = `1–${Number(d.today.slice(8, 10))} ${fmt.monthLower(d.today.slice(0, 7))}`;

  const ACTIONS: { key: Modal; label: string; Icon: typeof Wallet; tone: string }[] = [
    { key: { kind: "kirim" }, label: t("Kirim"), Icon: ArrowDownLeft, tone: "text-v2-success" },
    { key: { kind: "chiqim" }, label: t("Chiqim"), Icon: ArrowUpRight, tone: "text-v2-danger" },
    { key: { kind: "swap" }, label: t("Almashtirish"), Icon: ArrowLeftRight, tone: "text-v2-violet" },
    { key: { kind: "branch" }, label: t("Filialga berish"), Icon: Send, tone: "text-v2-info" },
    { key: { kind: "dividend" }, label: t("Dividend"), Icon: HandCoins, tone: "text-v2-warning" },
    { key: { kind: "sarmoya" }, label: t("Sarmoya"), Icon: PiggyBank, tone: "text-v2-success" },
  ];
  const TABS = [
    { key: "all", label: t("Hammasi"), n: d.counts.all },
    { key: "kirim", label: t("Kirim"), n: (d.counts.kirim ?? 0) + (d.counts.sarmoya ?? 0) },
    { key: "chiqim", label: t("Chiqim"), n: (d.counts.chiqim ?? 0) + (d.counts.dividend ?? 0) },
    { key: "kochirma", label: t("Ko'chirma"), n: d.counts.kochirma ?? 0 },
    { key: "almashtirish", label: t("Almashtirish"), n: d.counts.almashtirish ?? 0 },
  ];

  function exportCsv() {
    downloadCsv(`rahbar-kassasi-${d.today}.csv`, [t("Sana"), t("Vaqt"), t("Amal"), t("Izoh"), t("Filial"), t("To'lov turi"), t("Summa")], d.rows.map((r) => [r.date, r.time, r.title, r.sub, r.branch, d.methodNames[r.method] ?? r.method, r.amount]));
  }
  const done = () => reload();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Crumbs here="Rahbar kassasi" />
          <h1 className="text-v2-page text-v2-text">{t("Rahbar kassasi")}</h1>
          <p className="text-v2-small text-v2-text-2">
            {t("Bosh kassa")} · {d.primary.owner || d.primary.name} · {t("uni faqat siz ko'rasiz va o'zgartirasiz")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className={secondaryBtn}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Hisobot")}
          </button>
          <Link href="/amallar-jurnali" className={secondaryBtn}>
            <History className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Amallar jurnali")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Bosh kassa kartasi */}
          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-v2-md bg-v2-brand-bg text-v2-brand-text">
                  <Wallet className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-v2-body font-semibold text-v2-text">{d.primary.name}</span>
                    <Pill tone="warning">
                      <Crown className="size-3" aria-hidden />
                      {t("Bosh kassa")}
                    </Pill>
                  </div>
                  <span className="text-v2-caption text-v2-text-3">{d.primary.owner || t("Rahbar")}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[1.75rem] font-semibold leading-9 tabular-nums text-v2-text">{money(d.primary.total)}</span>
                <span className="text-v2-small text-v2-text-2">so&apos;m</span>
                <button type="button" onClick={() => setHide((v) => !v)} className="text-v2-text-3 hover:text-v2-text" aria-label={hide ? t("Ko'rsatish") : t("Yashirish")}>
                  {hide ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
                </button>
              </div>
              {incoming ? (
                <p className="text-v2-small text-v2-text-2">
                  {t("Kutilayotgan ko'chirma")}: <Link href="/owner-transfers" className="font-semibold text-v2-info">{money(incoming)} so&apos;m · {t("yo'lda")}</Link>
                </p>
              ) : null}
              {d.primary.outWaiting ? <p className="text-v2-small text-v2-text-2">{t("Filialga yo'lda")}: <b className="text-v2-text">{money(d.primary.outWaiting)}</b></p> : null}
              <div className="mt-3">
                <MoneyBar parts={methods.map((k) => ({ key: k, value: Number(d.primary.methods[k]) || 0, cls: methodDot(k) }))} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-v2-small">
                {methods.map((k) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${methodDot(k)}`} />
                    <span className="flex-1 text-v2-text-2">{d.methodNames[k] ?? k}</span>
                    <b className="tabular-nums text-v2-text">{money(Number(d.primary.methods[k]) || 0)}</b>
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-v2-border bg-v2-surface-2 p-3">
              {ACTIONS.map((a) => (
                <button key={a.label} type="button" onClick={() => setModal(a.key)} className="flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-v2-md border border-v2-border bg-v2-surface px-1.5 text-v2-small font-medium text-v2-text hover:bg-v2-hover">
                  <a.Icon className={`size-4 shrink-0 ${a.tone}`} strokeWidth={1.75} aria-hidden />
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Dividend va sarmoya */}
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle title={t("Dividend va sarmoya · {y}", { y: d.today.slice(0, 4) })} sub={t("tushum va xarajatga qo'shilmaydi")} />
            </div>
            {[
              { k: "dividend", label: t("Dividend"), v: d.dividend },
              { k: "sarmoya", label: t("Sarmoya"), v: d.sarmoya },
            ].map(({ k, label, v }) => {
              const ic = KIND_ICON[k];
              return (
                <div key={k} className="flex items-start gap-3 border-t border-v2-border px-4 py-3 sm:px-5">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-v2-md ${ic.tone}`}>
                    <ic.Icon className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-v2-small font-semibold text-v2-text">{label}</span>
                    <span className="block text-v2-caption text-v2-text-3">{v.parts.length ? v.parts.join(" · ") : t("bu yil hali yo'q")}</span>
                  </span>
                  <b className="tabular-nums text-v2-text">{money(v.total)}</b>
                </div>
              );
            })}
            <p className="border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-3 sm:px-5">{t("Foyda-zararda alohida qatorda ko'rinadi. Faqat Rahbar, faqat Rahbar kassasidan.")}</p>
          </Card>

          {/* Filial kassalari */}
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle
                title={t("Filial kassalari")}
                sub={t("topshiruvlar Ko'chirmalarda qabul qilinadi")}
                right={
                  <Link href="/owner-transfers" className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                    {t("Ko'chirmalar")}
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                }
              />
            </div>
            {d.branches.map((b, i) => (
              <div key={b.cashboxId} className="flex items-center gap-3 border-t border-v2-border px-4 py-3 sm:px-5">
                <BranchDot n={i + 1} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-v2-small font-semibold text-v2-text">{b.name}</span>
                  <span className="block truncate text-v2-caption text-v2-text-3">{b.owner || "—"}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <b className="tabular-nums text-v2-text">{money(b.pending || b.total)}</b>
                  {b.pending ? <Pill tone="info">{t("yo'lda")}</Pill> : b.total > 0 ? <Pill tone={b.days !== null && b.days < 2 ? "neutral" : "warning"}>{b.days === null ? t("topshirmagan") : t("{n} kun", { n: b.days })}</Pill> : <Pill tone="success">{t("topshirilgan")}</Pill>}
                </span>
              </div>
            ))}
          </Card>
        </div>

        {/* Amallar */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="!p-0 sm:!p-0">
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
              <div>
                <h2 className="text-v2-section text-v2-text">{t("Amallar · Rahbar kassasi")}</h2>
                <p className="text-v2-small text-v2-text-3">{t("ko'chirma — tushum ham, xarajat ham emas · faqat joyi o'zgaradi")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-9 items-center rounded-v2-md border border-v2-border px-3 text-v2-small text-v2-text-2">
                  {t("Davr")}: <b className="ml-1 text-v2-text">{monthFrom}</b>
                </span>
                <V2Select variant="chip" label={t("To'lov turi")} value={method} onChange={(v) => { setMethod(v); setPage(0); }} options={Object.entries(d.methodNames).map(([value, label]) => ({ value, label }))} />
                <button type="button" onClick={exportCsv} className={secondaryBtn}>
                  <Download className="size-4" strokeWidth={1.75} aria-hidden />
                  Excel
                </button>
              </div>
            </div>
            <div className="px-4 pb-3 sm:px-5">
              <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-v2-md bg-v2-surface-2 p-1" role="tablist">
                {TABS.map((x) => (
                  <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} onClick={() => { setTab(x.key); setPage(0); }} className={`h-8 shrink-0 rounded-v2-sm px-3 text-v2-small ${tab === x.key ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
                    {x.label} <span className="text-v2-text-3">{x.n}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-v2-small">
                <thead>
                  <tr className="border-y border-v2-border bg-v2-surface-2 text-v2-caption text-v2-text-2">
                    <th className="w-12 px-4 py-2 text-left font-medium sm:px-5">{t("Chek")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("Amal")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("Filial")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("Sana")}</th>
                    <th className="px-4 py-2 text-right font-medium sm:px-5">{t("Summa")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-v2-text-3">{t("Bu davrda amal yo'q.")}</td>
                    </tr>
                  ) : null}
                  {d.rows.map((r) => {
                    const ic = KIND_ICON[r.kind] ?? KIND_ICON.kirim;
                    return (
                      <tr key={r.id} className="border-t border-v2-border">
                        <td className="px-4 py-2.5 sm:px-5">
                          <button type="button" onClick={() => openReceipt({ entryId: r.id, cashboxId: d.primary.id, cashboxName: d.primary.name })} className="grid size-8 place-items-center rounded-v2-md border border-v2-border text-v2-text-2 hover:bg-v2-surface-2" aria-label={t("Chek")}>
                            <Printer className="size-4" strokeWidth={1.75} />
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2.5">
                            <span className={`grid size-8 shrink-0 place-items-center rounded-v2-md ${ic.tone}`}>
                              <ic.Icon className="size-4" strokeWidth={1.75} aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-v2-text">{r.title}</span>
                              <span className="block truncate text-v2-caption text-v2-text-3">{r.sub}{r.waiting ? ` · ${t("yo'lda")}` : ""}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-v2-text-2">{r.branch || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-v2-text-2">{fmt.dayMonth(r.date)}{r.time ? ` | ${r.time}` : ""}</td>
                        <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums sm:px-5 ${r.amount < 0 ? "text-v2-danger" : "text-v2-success"}`}>
                          {r.amount > 0 ? "+" : ""}
                          {money(r.amount)}
                          <span className="block text-v2-caption font-normal text-v2-text-3">{d.methodNames[r.method] ?? r.method}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-v2-border px-4 py-2.5 text-v2-small text-v2-text-2 sm:px-5">
              <span>{t("{n} ta ko'rsatildi · jami {m}", { n: d.rows.length, m: d.total })}</span>
              <span className="flex gap-2">
                <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={`${secondaryBtn} h-8 disabled:opacity-40`}>
                  <ChevronLeft className="size-4" aria-hidden />
                  {t("Oldingi")}
                </button>
                <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className={`${secondaryBtn} h-8 disabled:opacity-40`}>
                  {t("Keyingi")}
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </span>
            </div>
          </Card>
          <p className="flex gap-2 rounded-v2-md bg-v2-brand-bg px-4 py-3 text-v2-small text-v2-text">
            <Lock className="mt-0.5 size-4 shrink-0 text-v2-brand-text" aria-hidden />
            {t("Ko'chirma faqat Rahbar kassasi orqali: filial → Rahbar kassasi va Rahbar kassasi → filial. Filiallar o'rtasida ko'chirish yo'q. Dividend va Sarmoya — faqat shu kassada.")}
          </p>
        </div>
      </div>

      {modal && (modal.kind === "kirim" || modal.kind === "chiqim") ? (
        <CashOperationModalV2 initialCashboxId={d.primary.id} initialTab={modal.kind} onClose={() => setModal(null)} onSaved={done} />
      ) : null}
      {modal?.kind === "swap" ? <SwapDialog ctx={ctx} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal?.kind === "branch" ? <ToBranchDialog ctx={ctx} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal && (modal.kind === "dividend" || modal.kind === "sarmoya") ? <DividendDialog ctx={ctx} initial={modal.kind} onClose={() => setModal(null)} onDone={done} /> : null}
    </div>
  );
}
