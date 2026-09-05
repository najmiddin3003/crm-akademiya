"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { LegacyEntry } from "@/lib/legacyEntries";

// O'quvchi profili → "Tranzaksiyalar tarixi".
// Ma'lumot HAQIQIY: MongoDB `transaction_entries` dan
// /api/transaction-entries?studentName=…&txType=payIn orqali olinadi
// (StudentEditPage yuklaydi). Bu yerda faqat ko'rsatish va filtrlash.
//
// IKKI BO'LIM, BITTA JADVAL EMAS — ATAYLAB.
//
// Yuqorida CRM'ning O'Z yozuvlari (02.09.2026 dan beri), pastda esa
// edutizimdan ko'chirilgan ARXIV (09.2025 – 08.2026). Ularni bitta
// jadvalga qo'shib yuborish ikki xato tug'dirardi:
//   • yuqoridagi "Umumiy soni" va profil kartochkasidagi BALANS faqat
//     jonli yozuvlardan hisoblanadi — aralashtirilsa son bilan jadval
//     bir-biriga mos kelmay qolardi;
//   • arxiv yozuvining "oldingi/keyingi miqdor" ustunlari YO'Q (edutizim
//     ularni bermaydi), ya'ni umumiy jadvalda yarmi bo'sh ustun bo'lardi.
// Ajratilgani yana bir foyda beradi: qaysi qator qayerdan kelgani
// ko'rinib turadi.

function fmtSpace(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ");
}

const TX_TYPE_LABEL: Record<string, string> = {
  payIn: "Daromad",
  payOut: "Xarajat",
  transfer: "Ko'chirish",
};

const STATUS_LABEL: Record<string, string> = {
  "": "Tasdiqlangan",
  waiting: "Kutilmoqda",
  cancelled: "Bekor qilingan",
};

const STATUS_CLS: Record<string, string> = {
  "": "bg-emerald-500/10 text-emerald-600",
  waiting: "bg-amber-500/10 text-amber-600",
  cancelled: "bg-rose-500/10 text-rose-600",
};

export default function TranzaksiyaTabContent({
  entries,
  legacyEntries = [],
  loading = false,
}: {
  entries: TransactionEntry[];
  /** Edutizim arxivi — faqat ko'rsatiladi, hech qanday hisobga kirmaydi. */
  legacyEntries?: LegacyEntry[];
  loading?: boolean;
}) {
  const [paymentType, setPaymentType] = useState("");
  // Holat qiymati "" ham haqiqiy holat (tasdiqlangan) bo'lgani uchun
  // "hammasi" alohida sentinel bilan ajratiladi.
  const [status, setStatus] = useState("all");

  // Filtr variantlari mavjud yozuvlardan yig'iladi — bo'sh <select>
  // qoldirmaymiz.
  const paymentTypes = useMemo(
    () => [...new Set(entries.map((e) => e.paymentType).filter(Boolean))].sort(),
    [entries],
  );

  const rows = useMemo(
    () => entries.filter((e) =>
      (!paymentType || e.paymentType === paymentType) &&
      (status === "all" || (e.status || "") === (status === "ok" ? "" : status))),
    [entries, paymentType, status],
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button variant="icon" title="Filtr">
          <svg viewBox="0 0 24 24" className="icon icon-sm"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
        </Button>
        <Button variant="icon" icon="i-settings" title="Sozlash" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            className="w-full h-10 px-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">To&apos;lov turi — hammasi</option>
            {paymentTypes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full h-10 px-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">Holat — hammasi</option>
            <option value="ok">Tasdiqlangan</option>
            <option value="waiting">Kutilmoqda</option>
            <option value="cancelled">Bekor qilingan</option>
          </select>
          <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex justify-end p-3 border-b border-border">
          <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">
            Umumiy soni: {loading ? "…" : rows.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[12px] text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium">№</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Sana</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Miqdori</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Oldingi miqdor</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Keyingi miqdor</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Tranzaksiya turi</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">To&apos;lov turi</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Tranzaksiya nomi</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Qabul qilgan</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Holati</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-[13px] text-muted-foreground">Yuklanmoqda…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-[13px] text-muted-foreground">To&apos;lovlar topilmadi</td></tr>
              ) : (
                rows.map((e, i) => (
                  <tr key={e.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{e.date}{e.time ? ` | ${e.time}` : ""}</td>
                    <td className={`px-4 py-3 text-[13px] tabular-nums font-medium whitespace-nowrap ${e.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtSpace(e.amount)}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{fmtSpace(e.before)}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{e.after === null ? "—" : fmtSpace(e.after)}</td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">{TX_TYPE_LABEL[e.txType] ?? e.txType}</td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">{e.paymentType || "—"}</td>
                    <td className="px-4 py-3 text-[13px]">{e.txName || "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{e.moderator || "—"}</td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_CLS[e.status || ""] ?? "bg-secondary text-foreground/70"}`}>
                        {STATUS_LABEL[e.status || ""] ?? e.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDUTIZIM ARXIVI — faqat yozuvi bo'lgan o'quvchida chiziladi.
          Bo'sh bo'lsa umuman ko'rsatilmaydi: "arxiv yo'q" degan yozuv
          sentabrda qo'shilgan yangi o'quvchida shunchaki shovqin. */}
      {legacyEntries.length > 0 && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-border">
            <div>
              <div className="text-[13px] font-semibold">Edutizim arxivi</div>
              {/* Manba va CHEGARA aniq yozilgan: keyinroq "nega bu yerda
                  sentabr yo'q?" degan savol tug'ilmasin. */}
              <div className="text-[11.5px] text-muted-foreground mt-0.5">
                Eski tizimdagi to&apos;lovlar (avgust 2026 gacha) — faqat ko&apos;rish uchun,
                balansga qo&apos;shilmaydi
              </div>
            </div>
            <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums shrink-0">
              Umumiy soni: {legacyEntries.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[12px] text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium">№</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Sana</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Miqdori</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">To&apos;lov turi</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Tranzaksiya nomi</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Izoh</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Qabul qilgan</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Holati</th>
                </tr>
              </thead>
              <tbody>
                {legacyEntries.map((e, i) => (
                  <tr key={e.sourceId} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">
                      {e.date}{e.time ? ` | ${e.time}` : ""}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums font-medium whitespace-nowrap text-emerald-600">
                      {fmtSpace(e.amount)}
                    </td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">{e.paymentType || "—"}</td>
                    <td className="px-4 py-3 text-[13px]">{e.txName || "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground max-w-[220px] truncate" title={e.note}>
                      {e.note || "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{e.moderator || "—"}</td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_CLS[e.status || ""] ?? "bg-secondary text-foreground/70"}`}>
                        {STATUS_LABEL[e.status || ""] ?? e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
