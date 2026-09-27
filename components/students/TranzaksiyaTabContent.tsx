"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { LegacyEntry } from "@/lib/legacyEntries";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";

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
  const { t } = useT();
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
        <Button variant="icon" title={t("Filtr")}>
          <svg viewBox="0 0 24 24" className="icon icon-sm"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
        </Button>
        <Button variant="icon" icon="i-settings" title={t("Sozlash")} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select value={paymentType} onChange={(v) => setPaymentType(v)} options={paymentTypes.map((p) => ({ value: p, label: p }))} placeholder={t("To'lov turi — hammasi")} clearable />
        <Select value={status} onChange={(v) => setStatus(v)} options={[{ value: "all", label: t("Holat — hammasi") }, { value: "ok", label: t("Tasdiqlangan") }, { value: "waiting", label: t("Kutilmoqda") }, { value: "cancelled", label: t("Bekor qilingan") }]} />
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex justify-end p-3 border-b border-border">
          <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">
            Umumiy soni: {loading ? "…" : rows.length}
          </span>
        </div>
        <div className="table-box">
          <table className="w-full text-sm">
            <thead className="text-[12px] text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium">№</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Sana")}</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Miqdori")}</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Oldingi miqdor")}</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Keyingi miqdor")}</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Tranzaksiya turi")}</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("To'lov turi")}</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Tranzaksiya nomi")}</th>
                {/* IZOH — kassir kirim qilayotganda yozadigan matn
                    ("Musoxon avgust" kabi). U qaysi o'qituvchi va qaysi
                    oy uchun to'langanini aytadi, ya'ni tarixdagi eng
                    ma'noli ustunlardan biri. Arxiv jadvalida allaqachon
                    bor edi, jonli jadvalda esa yo'q edi. */}
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Izoh")}</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Qabul qilgan")}</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Holati")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-[13px] text-muted-foreground">{t("Yuklanmoqda…")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-[13px] text-muted-foreground">{t("To'lovlar topilmadi")}</td></tr>
              ) : (
                rows.map((e, i) => (
                  <tr key={e.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{e.date}{e.time ? ` | ${e.time}` : ""}</td>
                    <td className={`px-4 py-3 text-[13px] tabular-nums font-medium whitespace-nowrap ${e.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {fmtSpace(e.amount)}
                      {/* Tanga evaziga chegirma — naqddan tashqari, balansga qo'shilgan qism. */}
                      {!!e.discountSom && (
                        <div className="text-[11.5px] font-normal text-amber-600" title={t("Tanga evaziga chegirma — balansga qo'shildi, kassaga tushmagan")}>
                          🏷️ +{fmtSpace(e.discountSom)} {t("chegirma")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{fmtSpace(e.before)}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{e.after === null ? "—" : fmtSpace(e.after)}</td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">{TX_TYPE_LABEL[e.txType] ?? e.txType}</td>
                    <td className="px-4 py-3 text-[13px] whitespace-nowrap">{e.paymentType || "—"}</td>
                    <td className="px-4 py-3 text-[13px]">{e.txName || "—"}</td>
                    {/* Uzun izoh qatorni cho'zib yubormasin — kengligi
                        cheklangan, to'lig'i `title` da (kassa jadvalidagi
                        bilan bir xil qoida). */}
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
              <div className="text-[13px] font-semibold">{t("Edutizim arxivi")}</div>
              {/* Manba va CHEGARA aniq yozilgan: keyinroq "nega bu yerda
                  sentabr yo'q?" degan savol tug'ilmasin. */}
              <div className="text-[11.5px] text-muted-foreground mt-0.5">
                {t("Eski tizimdagi to'lovlar (avgust 2026 gacha) — faqat ko'rish uchun, balansga qo'shilmaydi")}
              </div>
            </div>
            <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums shrink-0">
              Umumiy soni: {legacyEntries.length}
            </span>
          </div>
          <div className="table-box">
            <table className="w-full text-sm">
              <thead className="text-[12px] text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium">№</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Sana")}</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Miqdori")}</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("To'lov turi")}</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Tranzaksiya nomi")}</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Izoh")}</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Qabul qilgan")}</th>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Holati")}</th>
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
