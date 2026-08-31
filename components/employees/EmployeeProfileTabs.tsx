"use client";

import { useMemo, useState } from "react";
import { Archive } from "lucide-react";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { TurnstileIoRecord } from "@/lib/turnstileIo";
import { TURNSTILE_IO_STATUS_LABELS } from "@/lib/turnstileIo";
import type { EmployeeNote } from "@/lib/employeeNotes";
import type { Bonus } from "@/lib/bonuses";
import type { Penalty } from "@/lib/penalties";
import type { PerformanceRow } from "@/lib/performanceReport";
import { STATE_KEYS, STATE_LABELS } from "@/lib/performanceReport";
import type { TeacherStudent } from "@/app/api/hr-employees/[id]/students/route";
import PersonLink from "@/components/shared/PersonDirectory";

// Xodim profilidagi tablar mazmuni. Hammasi HAQIQIY backend ma'lumotidan
// ishlaydi — manbasi yo'q tablar (Reyting, Qo'ng'iroqlar, Harakatlar tarixi,
// To'lanmagan oylik) bu yerda yo'q, ular EmployeeProfilePage'da halol bo'sh
// holat ko'rsatadi. Soxta ma'lumot to'qilmaydi.

export function nf(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}

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

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_CLS[status || ""] ?? "bg-secondary text-foreground/70"}`}>
      {STATUS_LABEL[status || ""] ?? status}
    </span>
  );
}

export function EmptyState({ text = "Ma'lumotlar topilmadi", hint }: { text?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center mb-3 text-muted-foreground">
        <Archive className="w-6 h-6" />
      </span>
      <div className="text-[14px] font-semibold">{text}</div>
      {hint && <div className="text-[12px] text-muted-foreground mt-1 max-w-md">{hint}</div>}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-muted-foreground mb-3">{children}</p>;
}

function Table({ head, children, count }: { head: string[]; children: React.ReactNode; count: number }) {
  return (
    <>
      <div className="flex items-center justify-end mb-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary/40 text-[11px] font-medium">
          Umumiy soni: <span className="ml-1 tabular-nums font-semibold">{count}</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              {head.map((h) => <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </>
  );
}

/* ── Avans tarixi / Oylik tarixi ─────────────────────────────────────────
   Manba: transaction_entries, xodimning o'ziga yozilgan chiqimlar
   (studentName = xodim ismi, txType = payOut), txName bo'yicha ajratiladi. */
export function PayoutHistoryTab({
  entries,
  cashboxName,
  caption,
}: {
  entries: TransactionEntry[];
  cashboxName: (id: number) => string;
  caption: string;
}) {
  if (entries.length === 0) return <EmptyState hint={caption} />;
  return (
    <>
      <Caption>{caption}</Caption>
      <Table head={["№", "Sana", "Turi", "To'lov usuli", "Kassa", "Qayd etgan", "Izoh", "Holati", "Miqdori"]} count={entries.length}>
        {entries.map((e, i) => (
          <tr key={e.id} className="hover:bg-secondary/30 transition-colors">
            <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
            <td className="px-4 py-3 tabular-nums whitespace-nowrap">{e.date}{e.time ? ` | ${e.time}` : ""}</td>
            <td className="px-4 py-3 whitespace-nowrap">{e.txName || "—"}</td>
            <td className="px-4 py-3 whitespace-nowrap">{e.paymentType || "—"}</td>
            <td className="px-4 py-3 whitespace-nowrap">{cashboxName(e.cashboxId)}</td>
            <td className="px-4 py-3 whitespace-nowrap"><PersonLink name={e.moderator} kind="staff" /></td>
            <td className="px-4 py-3">{e.note || "—"}</td>
            <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={e.status} /></td>
            <td className="px-4 py-3 tabular-nums font-medium text-rose-600 whitespace-nowrap">{nf(e.amount)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ── Balans tarixi ───────────────────────────────────────────────────────
   Uchta haqiqiy oqim birlashtiriladi: bonuslar (+), jarimalar (−) va
   to'langan avans/oylik (−).

   DIQQAT: bu XODIMNING BALANSI EMAS. Ishlab topilgan oylik (accrual)
   uchun tizimda manba yo'q, shu bois ustun aynan nima ekanligi bilan
   nomlanadi. transaction_entries.before/after ham yaramaydi — u odamniki
   emas, (kassa, to'lov turi) juftligining qoldig'i. */
export interface LedgerRow {
  key: string;
  sortAt: number;
  dateLabel: string;
  source: string;
  note: string;
  by: string;
  delta: number;
}

export function buildLedger(
  name: string,
  bonuses: Bonus[],
  penalties: Penalty[],
  payouts: TransactionEntry[],
): LedgerRow[] {
  const lc = name.trim().toLowerCase();
  const mine = (r: { type?: string; recipientName?: string; status?: string }) =>
    r.type === "employee" && (r.recipientName ?? "").trim().toLowerCase() === lc && r.status !== "cancelled";

  // "DD.MM.YYYY HH:mm" va "DD.MM.YYYY | HH:mm" — ikkalasi ham uchraydi.
  const parseUz = (s: string): number => {
    const m = (s || "").match(/(\d{2})\.(\d{2})\.(\d{4})\D+(\d{2}):(\d{2})/);
    if (!m) return 0;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
  };

  const rows: LedgerRow[] = [];
  for (const b of bonuses.filter(mine)) {
    rows.push({ key: `b${b.id}`, sortAt: parseUz(b.createdAt), dateLabel: b.createdAt, source: "Bonus", note: b.note || "—", by: b.givenBy || "—", delta: Number(b.amount) || 0 });
  }
  for (const p of penalties.filter(mine)) {
    rows.push({ key: `p${p.id}`, sortAt: parseUz(p.createdAt), dateLabel: p.createdAt, source: "Jarima", note: p.note || "—", by: "—", delta: -(Number(p.amount) || 0) });
  }
  for (const e of payouts) {
    if (e.status === "cancelled") continue;
    if (!/avans|oylik/i.test(e.txName || "")) continue;
    const at = new Date(`${e.date}T${e.time || "00:00"}:00`).getTime();
    rows.push({
      key: `e${e.id}`,
      sortAt: Number.isNaN(at) ? 0 : at,
      dateLabel: `${e.date}${e.time ? ` | ${e.time}` : ""}`,
      source: /oylik/i.test(e.txName || "") ? "Oylik" : "Avans",
      note: e.note || "—",
      by: e.moderator || "—",
      delta: -Math.abs(Number(e.amount) || 0),
    });
  }
  // Bir daqiqada yozilganlar uchun barqaror tartib — kalit bo'yicha.
  return rows.sort((a, c) => a.sortAt - c.sortAt || a.key.localeCompare(c.key));
}

/** Har bir qatorga o'sha nuqtadagi yig'indini qo'shadi. */
function withRunningTotals(rows: LedgerRow[]): (LedgerRow & { running: number })[] {
  const out: (LedgerRow & { running: number })[] = [];
  let acc = 0;
  for (const r of rows) {
    acc += r.delta;
    out.push({ ...r, running: acc });
  }
  return out;
}

export function BalanceTab({ rows }: { rows: LedgerRow[] }) {
  if (rows.length === 0) {
    return <EmptyState hint="Bu xodim uchun hali bonus, jarima yoki to'langan avans/oylik yozuvi yo'q." />;
  }
  const withRunning = withRunningTotals(rows);
  return (
    <>
      <Caption>
        Bonus, jarima va to&apos;langan avans/oylik yozuvlari — vaqt bo&apos;yicha.
        Ishlab topilgan oylik alohida hisoblanmaydi, shuning uchun oxirgi ustun
        <strong> balans emas</strong>, aynan shu uch oqim yig&apos;indisi.
      </Caption>
      <Table head={["№", "Sana", "Manba", "Izoh", "Qayd etgan", "O'zgarish", "Bonus − jarima − to'langan"]} count={withRunning.length}>
        {withRunning.map((r, i) => (
          <tr key={r.key} className="hover:bg-secondary/30 transition-colors">
            <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
            <td className="px-4 py-3 tabular-nums whitespace-nowrap">{r.dateLabel}</td>
            <td className="px-4 py-3 whitespace-nowrap">{r.source}</td>
            <td className="px-4 py-3">{r.note}</td>
            <td className="px-4 py-3 whitespace-nowrap">{r.by}</td>
            <td className={`px-4 py-3 tabular-nums font-medium whitespace-nowrap ${r.delta < 0 ? "text-rose-600" : "text-emerald-600"}`}>{nf(r.delta)}</td>
            <td className="px-4 py-3 tabular-nums whitespace-nowrap">{nf(r.running)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ── Ish soati ───────────────────────────────────────────────────────────
   Manba: turnstile_io (turniket kirish-chiqish), personName bo'yicha. */
function workedMinutes(r: TurnstileIoRecord): number | null {
  if (!r.enterTime || !r.exitTime) return null;
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const a = toMin(r.enterTime);
  const b = toMin(r.exitTime);
  if (a === null || b === null || b < a) return null;
  return b - a;
}

function fmtDuration(min: number | null): string {
  if (min === null) return "—";
  return `${Math.floor(min / 60)} soat ${String(min % 60).padStart(2, "0")} daq`;
}

export function WorkHoursTab({ records }: { records: TurnstileIoRecord[] }) {
  const totals = useMemo(() => {
    let mins = 0;
    const byStatus = { kelgan: 0, kechikkan: 0, kelmagan: 0 } as Record<string, number>;
    for (const r of records) {
      const m = workedMinutes(r);
      if (m !== null) mins += m;
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }
    return { mins, byStatus };
  }, [records]);

  if (records.length === 0) {
    return <EmptyState hint="Turniketda bu xodim nomiga yozuv topilmadi. Turniket ma'lumoti `turnstile_io` kolleksiyasidan olinadi." />;
  }

  return (
    <>
      <Caption>Turniket kirish-chiqish yozuvlari. Jami ishlangan vaqt: <strong>{fmtDuration(totals.mins)}</strong> · Kelgan {totals.byStatus.kelgan ?? 0} · Kechikkan {totals.byStatus.kechikkan ?? 0} · Kelmagan {totals.byStatus.kelmagan ?? 0}</Caption>
      <Table head={["№", "Sana", "Kirish vaqti", "Chiqish vaqti", "Ish soati", "Holati"]} count={records.length}>
        {records.map((r, i) => (
          <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
            <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
            <td className="px-4 py-3 tabular-nums whitespace-nowrap">{r.date}</td>
            <td className="px-4 py-3 tabular-nums whitespace-nowrap">{r.enterTime ?? "—"}</td>
            <td className="px-4 py-3 tabular-nums whitespace-nowrap">{r.exitTime ?? "—"}</td>
            <td className="px-4 py-3 tabular-nums whitespace-nowrap">{fmtDuration(workedMinutes(r))}</td>
            <td className="px-4 py-3 whitespace-nowrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                r.status === "kelgan" ? "bg-emerald-500/10 text-emerald-600"
                : r.status === "kechikkan" ? "bg-amber-500/10 text-amber-600"
                : "bg-rose-500/10 text-rose-600"}`}>
                {TURNSTILE_IO_STATUS_LABELS[r.status] ?? r.status}
              </span>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ── To'lanmagan to'lovlar ───────────────────────────────────────────────
   Manba: unpaid_students (o'quvchilarning to'lamagan puli), o'qituvchining
   guruhlaridagi o'quvchilarga qisqartirilgan. */
export interface UnpaidRow {
  id: number;
  studentName: string;
  groups: string;
  unpaidLessons: number;
  totalUnpaid: number;
}

export function UnpaidTab({ rows, rosterEmpty }: { rows: UnpaidRow[]; rosterEmpty: boolean }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        hint={rosterEmpty
          ? "Bu xodimga guruh biriktirilmagan. Guruhga o'qituvchi belgilangach, uning o'quvchilari qarzi shu yerda ko'rinadi."
          : "Bu xodimning o'quvchilarida to'lanmagan summa yo'q."}
      />
    );
  }
  const total = rows.reduce((s, r) => s + (Number(r.totalUnpaid) || 0), 0);
  return (
    <>
      <Caption>O&apos;qituvchining guruhlaridagi o&apos;quvchilar qarzi. Jami: <strong>{nf(total)}</strong></Caption>
      <Table head={["№", "O'quvchi", "Guruh", "To'lanmagan darslar", "Summa"]} count={rows.length}>
        {rows.map((r, i) => (
          <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
            <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
            <td className="px-4 py-3 whitespace-nowrap"><PersonLink name={r.studentName} /></td>
            <td className="px-4 py-3 whitespace-nowrap">{r.groups || "—"}</td>
            <td className="px-4 py-3 tabular-nums">{r.unpaidLessons}</td>
            <td className="px-4 py-3 tabular-nums font-medium text-rose-600 whitespace-nowrap">{nf(r.totalUnpaid)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ── To'lanmagan tarixi ──────────────────────────────────────────────────
   Manba: transaction_entries — shu xodim qabul qilgan, lekin oxiriga
   yetmagan to'lovlar (bekor qilingan yoki kutilayotgan). */
export function UnpaidHistoryTab({ entries }: { entries: TransactionEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState hint="Bu xodimda bekor qilingan yoki kutilayotgan to'lov yozuvi yo'q." />;
  }
  return (
    <>
      <Caption>Shu xodim qabul qilgan, lekin oxiriga yetmagan to&apos;lovlar — bekor qilingan yoki kutilayotgan.</Caption>
      <Table head={["№", "Sana", "O'quvchi", "Tranzaksiya nomi", "To'lov turi", "Holati", "Izoh", "Miqdori"]} count={entries.length}>
        {entries.map((e, i) => (
          <tr key={e.id} className="hover:bg-secondary/30 transition-colors">
            <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
            <td className="px-4 py-3 tabular-nums whitespace-nowrap">{e.date}{e.time ? ` | ${e.time}` : ""}</td>
            <td className="px-4 py-3 whitespace-nowrap"><PersonLink name={e.studentName} /></td>
            <td className="px-4 py-3 whitespace-nowrap">{e.txName || "—"}</td>
            <td className="px-4 py-3 whitespace-nowrap">{e.paymentType || "—"}</td>
            <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={e.status} /></td>
            <td className="px-4 py-3">{e.note || "—"}</td>
            <td className="px-4 py-3 tabular-nums font-medium whitespace-nowrap">{nf(e.amount)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ── KPI ─────────────────────────────────────────────────────────────────
   Faqat manbasi bor ko'rsatkichlar. Davomat/Akladi kabilar bu yerda YO'Q —
   ular uchun ma'lumot yo'q va "0" yozib qo'yish yolg'on bo'lardi. */
/**
 * Uchta birinchi ko'rsatkich SERVERDA hisoblanadi
 * (/api/transaction-entries/moderator-summary).
 *
 * Ilgari bu komponent butun to'lovlar ro'yxatini prop sifatida olardi va
 * uchta sonni o'zi chiqarardi. Eng band moderatorda bu 13 369 qator
 * (~6 MB) degani edi — uchta son uchun.
 *
 * DIQQAT: "To'lov qilgan o'quvchilar" XOM ism bo'yicha sanaladi (ilgari
 * `new Set(live.map(e => e.studentName))` edi, ya'ni trim/kichik harfsiz).
 * Server ham `$addToSet` ni xom maydonga qo'llaydi — normallashtirilsa son
 * o'zgarib ketardi (2 813 o'rniga 2 788).
 */
export function KpiTab({
  paymentsCount,
  paymentsAmount,
  paymentsStudents,
  avans,
  oylik,
  bonus,
  jarima,
  students,
}: {
  paymentsCount: number;
  paymentsAmount: number;
  paymentsStudents: number;
  avans: number;
  oylik: number;
  bonus: number;
  jarima: number;
  students: TeacherStudent[];
}) {
  const groups = new Set(students.map((s) => s.groupId)).size;

  const tiles: { label: string; value: string }[] = [
    { label: "Qabul qilingan to'lovlar", value: String(paymentsCount) },
    { label: "Qabul qilingan summa", value: nf(paymentsAmount) },
    { label: "To'lov qilgan o'quvchilar", value: String(paymentsStudents) },
    { label: "Bonus", value: nf(bonus) },
    { label: "Jarima", value: nf(jarima) },
    { label: "Avans", value: nf(avans) },
    { label: "Oylik", value: nf(oylik) },
    { label: "Guruhlar / o'quvchilar", value: `${groups} / ${students.length}` },
  ];

  return (
    <>
      <Caption>Manbasi bor ko&apos;rsatkichlar. Davomat va akladi bu yerda yo&apos;q — ular uchun tizimda hisob yuritilmaydi.</Caption>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[12px] text-muted-foreground">{t.label}</div>
            <div className="text-[17px] font-bold tabular-nums mt-1">{t.value}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── O'qituvchining hisoboti ─────────────────────────────────────────────
   Manba: orders kolleksiyasi + lib/performanceReport.ts. */
export function TeacherReportTab({ row }: { row: PerformanceRow | null }) {
  if (!row) {
    return <EmptyState hint="Bu xodimga biriktirilgan buyurtma topilmadi. Buyurtmada o'qituvchi/moderator ko'rsatilgach shu yerda hisobot chiqadi." />;
  }
  return (
    <>
      <Caption>Buyurtmalar bo&apos;yicha holat — davr boshi, o&apos;zgarish va davr oxiri.</Caption>
      <Table head={["Holat", "Davr boshida", "O'zgarish", "Davr oxirida"]} count={STATE_KEYS.length}>
        {STATE_KEYS.map((k) => (
          <tr key={k} className="hover:bg-secondary/30 transition-colors">
            <td className="px-4 py-3 whitespace-nowrap">{STATE_LABELS[k]}</td>
            <td className="px-4 py-3 tabular-nums">{row.start[k]}</td>
            <td className="px-4 py-3 tabular-nums">{row.change[k]}</td>
            <td className="px-4 py-3 tabular-nums font-medium">{row.end[k]}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

/* ── Eslatma ─────────────────────────────────────────────────────────────
   Manba: employee_notes. Demo bilan to'ldirilmaydi — faqat odam yozgani. */
export function NotesTab({
  notes,
  onAdd,
  onDelete,
  busy,
}: {
  notes: EmployeeNote[];
  onAdd: (text: string) => Promise<boolean>;
  onDelete: (id: number) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  // Matn faqat saqlangandan KEYIN tozalanadi — aks holda tarmoq uzilsa
  // yozilgan eslatma yo'qoladi.
  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    if (await onAdd(t)) setText("");
  };
  return (
    <div className="flex flex-col gap-3 min-h-[420px]">
      <div className="flex-1 space-y-2 overflow-y-auto max-h-[420px] pr-1">
        {notes.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground">Hali eslatma yozilmagan.</div>
        ) : notes.map((n) => (
          <div key={n.id} className="rounded-xl border border-border bg-secondary/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[13px] whitespace-pre-wrap break-words">{n.text}</div>
              <button
                type="button"
                onClick={() => onDelete(n.id)}
                className="text-[11px] text-muted-foreground hover:text-rose-600 shrink-0"
                title="O'chirish"
              >
                O&apos;chirish
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5">{n.author} · {n.createdAt}</div>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2 border-t border-border pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }}
          rows={2}
          placeholder="Eslatma qoldirish… (Ctrl+Enter — yuborish)"
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !text.trim()}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
        >
          Yuborish
        </button>
      </div>
    </div>
  );
}
