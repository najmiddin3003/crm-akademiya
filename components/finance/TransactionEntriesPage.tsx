"use client";

import { useEffect, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { CashboxName } from "@/lib/cashboxes";
import PersonLink from "@/components/shared/PersonDirectory";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import UnassignedPupilModal from "@/components/finance/UnassignedPupilModal";
import { useT } from "@/components/shared/Language";

// Moliya → Tranzaksiyalar (sidebar: Moliya > Tranzakisyalar, href
// /finance-transactions). Sof jurnal — add/edit/delete yo'q (manba saytida
// ham yo'q edi). Manba saytida 22 979 ta haqiqiy yozuv bor edi; foydalanuvchi
// bilan kelishilgan yengil qamrov — bu yerda ~28 ta demo yozuv (constants/
// transactionEntries.js), lekin BARCHA ustunlar/filtrlar to'liq ishlaydi.
// Har (kassa, to'lov turi) juftligi o'z "oldingi/keyingi miqdor" zanjiriga
// ega — Kassalar sahifasidagi har to'lov usulini alohida hisoblash g'oyasi
// bilan bir xil.

const TX_TYPES = [
  { key: "payIn", label: "Kirim (payIn)" },
  { key: "payOut", label: "Chiqim (payOut)" },
  { key: "transfer", label: "Ko'chirish (transfer)" },
];
const STATUSES = [
  { key: "waiting", label: "Kutilmoqda" },
  { key: "cancelled", label: "Bekor qilingan" },
];

function fmtUZS(n: number | null): string {
  if (n == null) return "—";
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU");
}
function fmtDate(e: TransactionEntry): string {
  const [y, m, d] = e.date.split("-");
  return `${d}.${m}.${y} | ${e.time}`;
}

export default function TransactionEntriesPage() {
  const { t } = useT();
  const [entries, setEntries] = useState<TransactionEntry[]>([]);
  const [cashboxes, setCashboxes] = useState<CashboxName[]>([]);
  const [loading, setLoading] = useState(true);

  const [cashboxId, setCashboxId] = useState("");
  const [txType, setTxType] = useState("");
  const [status, setStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [student, setStudent] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // EGASI ANIQLANMAGAN TO'LOVLAR — ismi takrorlangani uchun mashina
  // qaysi o'quvchi ekanini ajrata olmagan qatorlar (lib/pupilEntries.ts).
  // Ular jurnalda oddiy qator bo'lib turibdi, lekin o'quvchi profilida
  // ISMDOSHLARNING IKKALASIDA ham ko'rinadi — shuning uchun yuqorida
  // eslatma bo'lib chiqadi.
  //
  // BIR MARTALIK QOLDIQ: yangi to'lovlar kassa oynasida o'quvchi ID'si
  // bilan yoziladi, ya'ni bu son faqat kamayadi. Nolga tushsa eslatma
  // butunlay yo'qoladi — o'lik tugma qolmaydi.
  const [unassigned, setUnassigned] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);

  // Filtrlash ham, sahifalash ham SERVERDA. Ilgari bu sahifa butun
  // jadvalni (25 569 qator, ~11 MB) yuklab, hammasini brauzerda
  // filtrlab-kesardi — ekranda esa bir vaqtda 50 qator turadi.
  const [total, setTotal] = useState(0);
  const [studentOptions, setStudentOptions] = useState<string[]>([]);

  // Kassalar va "O'quvchi" filtri ro'yxati — bir marta.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/cashboxes?names=1").then((r) => r.json()),
      fetch("/api/transaction-entries/students").then((r) => r.json()),
      fetch("/api/transaction-entries/unassigned").then((r) => r.json()).catch(() => null),
    ]).then(([cb, st, un]) => {
      if (cancelled) return;
      if (cb.ok) setCashboxes(cb.cashboxes);
      if (st.ok) setStudentOptions(st.students);
      if (un?.ok) setUnassigned(un.count as number);
    });
    return () => { cancelled = true; };
  }, []);

  // Filtr yoki sahifa o'zgarganda — faqat ko'rinadigan qatorlar.
  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (cashboxId) qs.set("cashboxId", cashboxId);
    if (txType) qs.set("txType", txType);
    if (status) qs.set("status", status);
    if (student) qs.set("studentName", student);
    if (dateRange.start) qs.set("dateFrom", dateRange.start.toISOString().slice(0, 10));
    if (dateRange.end) qs.set("dateTo", dateRange.end.toISOString().slice(0, 10));
    fetch(`/api/transaction-entries?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setEntries(d.entries);
        setTotal(d.total);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, cashboxId, txType, status, student, dateRange]);

  // Server allaqachon filtrlab, kesib bergan — bu yerda qo'shimcha ish yo'q.
  // `total` esa filtrga mos JAMI son (sahifadagi qatorlar soni emas).
  const slice = entries;
  const start = (page - 1) * pageSize;


  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Select value={cashboxId} onChange={(v) => { setCashboxId(v); setPage(1); }} options={cashboxes.map((c) => ({ value: String(c.id), label: c.name }))} placeholder={t("Kassa")} clearable size="sm" className="w-40" />
        <Select value={txType} onChange={(v) => { setTxType(v); setPage(1); }} options={TX_TYPES.map((tv) => ({ value: tv.key, label: tv.label }))} placeholder={t("Turi")} clearable size="sm" className="w-40" />
        <Select value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUSES.map((s) => ({ value: s.key, label: s.label }))} placeholder={t("Holati")} clearable size="sm" className="w-40" />
        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} placeholder={t("Oraliqni tanlang")} className="w-52" />
        <div className="w-52">
          <StudentSearchSelect label="" value={student} onChange={(v) => { setStudent(v); setPage(1); }} options={studentOptions} placeholder={t("O'quvchi")} />
        </div>
      </div>

      {unassigned > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <div className="text-[12.5px] text-amber-800 dark:text-amber-300">
            <strong>{t("{n} ta to'lovning o'quvchisi aniqlanmagan", { n: unassigned })}</strong>
            {" — "}
            {t("ismi takrorlangani uchun ular ismdosh o'quvchilarning IKKALASIDA ham ko'rinadi.")}
          </div>
          <Button variant="primary" className="shrink-0" onClick={() => setAssignOpen(true)}>
            {t("Biriktirish")}
          </Button>
        </div>
      )}

      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
          <span className="font-bold tabular-nums">{total}</span>
        </div>
      </div>

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Sana")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("O'quvchi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Miqdori")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Oldingi miqdor")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Keyingi miqdor")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Tranzaksiya turi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Tranzaksiya nomi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("To'lov turi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Guruh")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Dars sanasi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Moderator")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Sababi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Izoh")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Holati")}</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((e, i) => (
                <tr key={e.id} className={`border-b border-border/50 ${e.status === "cancelled" ? "bg-rose-50" : ""}`}>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtDate(e)}</td>
                  <td className="px-3 py-3 text-[13px] whitespace-nowrap"><PersonLink name={e.studentName} /></td>
                  <td className={`px-3 py-3 text-[13px] tabular-nums font-medium ${e.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtUZS(e.amount)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(e.before)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtUZS(e.after)}</td>
                  <td className="px-3 py-3 text-[13px]">{t(e.txType)}</td>
                  <td className="px-3 py-3 text-[13px]">{e.txName || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{t(e.paymentType)}</td>
                  <td className="px-3 py-3 text-[13px]">{e.group || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{e.lessonDate || "—"}</td>
                  <td className="px-3 py-3 text-[13px] whitespace-nowrap"><PersonLink name={e.moderator} kind="staff" /></td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{e.reason || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{e.note || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{e.status || "—"}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Tranzaksiya topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </div>

      {assignOpen && (
        <UnassignedPupilModal
          onClose={() => setAssignOpen(false)}
          onChanged={setUnassigned}
        />
      )}
    </div>
  );
}
