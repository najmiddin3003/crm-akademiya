"use client";

import { useState } from "react";
import { Calendar, Download, Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useLang, useT } from "@/components/shared/Language";
import type { DateRange } from "@/components/ui/DateRangePicker";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Chip, FieldError, Segmented } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2DateRange, { rangeLabel } from "@/components/v2/ui/V2DateRange";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { compareRange, monthlyMoney, moneyTotals, pctChange, shiftMonths, type CompareMode, type DayRange, type FunnelStats, type SummaryRow } from "@/lib/financeAnalytics";
import type { CashboxName } from "@/lib/cashboxes";
import { fetchJson } from "@/lib/fetchJson";
import type { Transaction } from "@/lib/transactions";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";
import { downloadCsv, downloadXlsx, printPdf, type Cell, type ReportDoc, type ReportSection } from "./analyticsReport";

// YANGI VERSIYA — «HISOBOTNI YUKLAB OLISH» (rasm «Hisobotni yuklab olish», yorug'/
// qorong'i, 20.10.2026): Davr (Shu oy · 1–20-oktyabr / O'tgan oy / Chorak / Boshqa
// davr), Nimalar kirsin (Kirim va chiqim · oyma-oy, Sof foyda, Lid → o'quvchi,
// Kassalar bo'yicha tranzaksiyalar — har amal alohida qatorda), Format (Excel / PDF /
// CSV). Filial va kassa — sahifadagi tanlov. Raqamlar sahifa bilan bir xil hisob
// (lib/financeAnalytics.ts); fayl — ./analyticsReport.ts.

type Kind = "month" | "prevMonth" | "quarter" | "custom";
type Format = "xlsx" | "pdf" | "csv";

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dateOf(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
/** Oraliqdagi oylar: "2026-08-15".."2026-10-20" → ["2026-08", "2026-09", "2026-10"]. */
function monthsBetween(r: DayRange): string[] {
  const out: string[] = [];
  for (let m = r.from.slice(0, 7); m <= r.to.slice(0, 7); m = shiftMonths(`${m}-01`, 1).slice(0, 7)) out.push(m);
  return out;
}

export default function AnalyticsReportModal({
  pageRange,
  pagePresetKey,
  compare,
  cbSet,
  cashboxes,
  leadBranch,
  scopeLabel,
  onClose,
}: {
  pageRange: DayRange;
  pagePresetKey: string | null;
  compare: CompareMode;
  cbSet: ReadonlySet<number> | null;
  cashboxes: CashboxName[];
  leadBranch: string;
  scopeLabel: string;
  onClose: () => void;
}) {
  const { t, months } = useT();
  const [lang] = useLang();
  const { showToast } = useToast();
  const modal = useModalClose(onClose, "center");

  const today = uzDateIso();
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevStart = shiftMonths(monthStart, -1);
  const prevEnd = isoOf(new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0));
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
  const quarterStart = `${today.slice(0, 4)}-${String(q * 3 + 1).padStart(2, "0")}-01`;

  const [kind, setKind] = useState<Kind>(pagePresetKey === "month" ? "month" : pagePresetKey === "lastmonth" ? "prevMonth" : "custom");
  const [custom, setCustom] = useState<DateRange>({ start: dateOf(pageRange.from), end: dateOf(pageRange.to) });
  const [parts, setParts] = useState({ cash: true, net: true, leads: true, tx: false });
  const [format, setFormat] = useState<Format>("xlsx");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const customRange: DayRange = {
    from: custom.start ? isoOf(custom.start) : pageRange.from,
    to: custom.start ? (isoOf(custom.end ?? custom.start) > today ? today : isoOf(custom.end ?? custom.start)) : pageRange.to,
  };
  const range: DayRange =
    kind === "month" ? { from: monthStart, to: today } : kind === "prevMonth" ? { from: prevStart, to: prevEnd } : kind === "quarter" ? { from: quarterStart, to: today } : customRange;
  const label = (r: DayRange) => rangeLabel({ start: dateOf(r.from), end: dateOf(r.to) }, lang, t);
  const nothing = !parts.cash && !parts.net && !parts.leads && !parts.tx;

  async function submit() {
    if (busy) return;
    if (nothing) {
      setErr(t("Kamida bitta bo'limni tanlang"));
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();
      const cmp = compareRange(range, compare);
      const needMoney = parts.cash || parts.net;
      const leadQs = new URLSearchParams({ from: range.from, to: range.to });
      if (leadBranch) leadQs.set("branchId", leadBranch);
      const [money, prev, leads, tx] = await Promise.all([
        needMoney ? fetchJson<{ rows: SummaryRow[] }>(`/api/transactions/summary?${qs({ groupBy: "month,sign,category,cashbox", from: range.from, to: range.to })}`).then((d) => d.rows) : null,
        parts.net && cmp ? fetchJson<{ rows: SummaryRow[] }>(`/api/transactions/summary?${qs({ groupBy: "sign,category,cashbox", from: cmp.from, to: cmp.to })}`).then((d) => d.rows) : null,
        parts.leads ? fetchJson<{ period: FunnelStats }>(`/api/analytics/leads?${leadQs}`).then((d) => d.period) : null,
        parts.tx ? fetchJson<{ transactions: Transaction[] }>(`/api/transactions?${qs({ from: range.from, to: range.to })}`).then((d) => d.transactions) : null,
      ]);

      const sections: ReportSection[] = [];
      const monthName = (key: string) => {
        const [y, m] = key.split("-").map(Number);
        return `${months[m - 1] ?? key} ${y}`;
      };
      if (parts.cash && money) {
        const ms = monthsBetween(range);
        const totals = monthlyMoney(money, ms, cbSet);
        const all = moneyTotals(money, cbSet);
        sections.push({
          title: t("Kirim va chiqim · oyma-oy"),
          columns: [t("Oy"), t("Kirim, so'm"), t("Chiqim, so'm"), t("Sof foyda, so'm")],
          rows: [...ms.map((m, i): Cell[] => [monthName(m), Math.round(totals[i].income), Math.round(totals[i].expense), Math.round(totals[i].net)]), [t("Jami"), Math.round(all.income), Math.round(all.expense), Math.round(all.net)]],
          totalRow: true,
        });
      }
      if (parts.net && money) {
        const c = moneyTotals(money, cbSet);
        const p = prev ? moneyTotals(prev, cbSet) : null;
        const ch = (a: number, b: number | undefined) => {
          const v = b === undefined ? null : pctChange(a, b);
          return v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}%`;
        };
        sections.push({
          title: t("Sof foyda"),
          columns: [t("Ko'rsatkich"), label(range), ...(cmp ? [label(cmp), t("O'zgarish")] : [])],
          rows: [
            [t("Tushum"), Math.round(c.income), ...(cmp ? [Math.round(p?.income ?? 0), ch(c.income, p?.income)] : [])],
            [t("Chiqim"), Math.round(c.expense), ...(cmp ? [Math.round(p?.expense ?? 0), ch(c.expense, p?.expense)] : [])],
            [t("Sof foyda"), Math.round(c.net), ...(cmp ? [Math.round(p?.net ?? 0), ch(c.net, p?.net)] : [])],
          ],
          totalRow: true,
        });
      }
      if (parts.leads && leads) {
        const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");
        const stages = [t("Lidlar"), t("Bog'lanildi"), t("Birinchi darsga yozildi"), t("Guruhga qo'shildi")];
        sections.push({
          title: t("Lid → o'quvchi · bosqichlar"),
          columns: [t("Bosqich"), t("Lidlar"), t("Ulushi")],
          rows: stages.map((s, i) => [s, leads.reached[i], pct(leads.reached[i], leads.total)]),
        });
        sections.push({
          title: t("Lid → o'quvchi · manbalar"),
          columns: [t("Manba"), t("Lidlar"), t("O'quvchi bo'ldi"), t("Konversiya")],
          rows: leads.sources.map((s) => [s.source === "—" ? t("Manba ko'rsatilmagan") : t(s.source), s.total, s.joined, pct(s.joined, s.total)]),
        });
      }
      if (parts.tx && tx) {
        const names = new Map(cashboxes.map((c) => [c.id, c.name]));
        const list = tx.filter((r) => !cbSet || cbSet.has(r.cashboxId)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.id - b.id);
        sections.push({
          title: t("Kassalar bo'yicha tranzaksiyalar"),
          columns: [t("Sana"), t("Vaqt"), t("Kassa"), t("Turi"), t("To'lov turi"), t("Kirim, so'm"), t("Chiqim, so'm")],
          rows: list.map((r) => [r.date, r.time || "", names.get(r.cashboxId) ?? `#${r.cashboxId}`, t(r.category || ""), t(r.methodLabel || r.method || ""), r.amount > 0 ? Math.round(r.amount) : "", r.amount < 0 ? Math.round(-r.amount) : ""]),
        });
      }

      const doc: ReportDoc = {
        title: t("Moliya analitikasi"),
        subtitle: `${label(range)} · ${scopeLabel}`,
        sections,
        fileBase: `moliya-analitikasi_${range.from}_${range.to}`,
      };
      if (format === "xlsx") await downloadXlsx(doc);
      else if (format === "csv") downloadCsv(doc);
      else printPdf(doc, t("Tayyorlandi: {when}", { when: `${today} ${uzTimeHm()}` }));
      showToast({
        tone: "success",
        title: format === "pdf" ? t("Chop etish oynasi ochildi") : t("Hisobot yuklab olindi"),
        detail: format === "pdf" ? t("«PDF sifatida saqlash» ni tanlang") : doc.subtitle,
      });
      modal.close();
    } catch {
      setErr(t("Hisobotni tayyorlab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setBusy(false);
    }
  }

  const items: { key: keyof typeof parts; label: string; hint?: string }[] = [
    { key: "cash", label: t("Kirim va chiqim · oyma-oy") },
    { key: "net", label: t("Sof foyda") },
    { key: "leads", label: t("Lid → o'quvchi") },
    { key: "tx", label: t("Kassalar bo'yicha tranzaksiyalar"), hint: t("har bir amal alohida qatorda") },
  ];

  return (
    <V2Dialog
      title={t("Hisobotni yuklab olish")}
      subtitle={`${t("Moliya analitikasi")} · ${scopeLabel === t("Barcha filiallar") ? scopeLabel.toLowerCase() : scopeLabel}`}
      onClose={onClose}
      controller={modal}
      saving={busy}
      onSubmit={() => void submit()}
      footerStart={
        <span className="hidden items-center gap-3 whitespace-nowrap text-v2-caption font-normal text-v2-text-3 sm:inline-flex">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded-v2-sm border border-v2-border bg-v2-surface px-1.5 py-px font-sans text-[11px] text-v2-text-2">Enter</kbd>
            {t("yuklab olish")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded-v2-sm border border-v2-border bg-v2-surface px-1.5 py-px font-sans text-[11px] text-v2-text-2">Esc</kbd>
            {t("yopish")}
          </span>
        </span>
      }
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={busy} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className={`${primaryBtn} h-10 justify-center disabled:opacity-60`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" strokeWidth={2} aria-hidden />}
            {busy ? t("Tayyorlanmoqda...") : t("Yuklab olish")}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-v2-small font-medium text-v2-text">{t("Davr")}</div>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("Davr")}>
            <Chip on={kind === "month"} onClick={() => setKind("month")} title={label({ from: monthStart, to: today })} data-autofocus={kind === "month" ? "" : undefined}>
              <span>{t("Shu oy")}</span>
              <span className={kind === "month" ? "font-normal opacity-80" : "text-v2-text-2"}>· {label({ from: monthStart, to: today })}</span>
            </Chip>
            <Chip on={kind === "prevMonth"} onClick={() => setKind("prevMonth")} title={label({ from: prevStart, to: prevEnd })} data-autofocus={kind === "prevMonth" ? "" : undefined}>
              {t("O'tgan oy")}
            </Chip>
            <Chip on={kind === "quarter"} onClick={() => setKind("quarter")} title={label({ from: quarterStart, to: today })}>
              {t("Chorak")}
            </Chip>
            <V2DateRange
              value={custom}
              onChange={(r) => {
                setCustom(r);
                setKind("custom");
              }}
              allowAll={false}
              align="end"
              trigger={(trigger, open) => (
                <Chip on={kind === "custom"} onClick={trigger.onClick} ref={trigger.ref} aria-haspopup="dialog" aria-expanded={open} data-autofocus={kind === "custom" ? "" : undefined}>
                  <span>{kind === "custom" ? label(customRange) : t("Boshqa davr")}</span>
                  <Calendar className="size-3.5" strokeWidth={1.75} aria-hidden />
                </Chip>
              )}
            />
          </div>
          {kind !== "month" && kind !== "custom" && <p className="mt-1.5 text-v2-caption text-v2-text-3">{label(range)}</p>}
        </div>

        <div>
          <div className="mb-2 text-v2-small font-medium text-v2-text">{t("Nimalar kirsin")}</div>
          <div className="space-y-0.5 rounded-v2-lg border border-v2-border p-1.5">
            {items.map((it) => (
              <label key={it.key} className="flex cursor-pointer items-start gap-3 rounded-v2-md px-2.5 py-1.5 hover:bg-v2-hover">
                <span className="mt-0.5">
                  <V2Checkbox
                    checked={parts[it.key]}
                    onChange={(v) => {
                      setParts((p) => ({ ...p, [it.key]: v }));
                      setErr("");
                    }}
                    label={it.label}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-v2-body text-v2-text">{it.label}</span>
                  {it.hint && <span className="block text-v2-caption text-v2-text-3">{it.hint}</span>}
                </span>
              </label>
            ))}
          </div>
          {err && <FieldError>{err}</FieldError>}
        </div>

        <div>
          <div className="mb-2 text-v2-small font-medium text-v2-text">{t("Format")}</div>
          <Segmented
            value={format}
            onChange={(v) => setFormat(v as Format)}
            label={t("Format")}
            options={[
              { value: "xlsx", label: "Excel" },
              { value: "pdf", label: "PDF" },
              { value: "csv", label: "CSV" },
            ]}
          />
        </div>
      </div>
    </V2Dialog>
  );
}
