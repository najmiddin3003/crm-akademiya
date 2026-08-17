"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { SMS_STATUSES, SMS_TABS, formatSmsDate, type SmsKind, type SmsMessage } from "@/lib/smsMessages";

// Sotuv va marketing → Xabarlar ro'yhati (sidebar: Sotuv va marketing >
// Xabarlar ro'yhati, href /sales-messages). Ma'lumot HAQIQIY —
// /api/sms-messages (MongoDB `sms_messages`). Sof jurnal: qo'shish/tahrirlash
// yo'q, faqat filtrlash.
//
// Referensdagi "Integratsiyalar" va "SMS qurilmalar" filtrlari loyihada
// hali mos ma'lumotga ega emas (lib/eskiz.ts bitta shlyuz bilan ishlaydi),
// shuning uchun ular qo'yilmadi — o'rniga "Holati" filtri bor, u haqiqiy.

const selectCls =
  "h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const STATUS_TONE: Record<string, string> = {
  "Qabul qilindi": "text-emerald-600",
  Kutilmoqda: "text-amber-600",
  Yuborilmadi: "text-rose-600",
};

export default function SmsMessagesPage() {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"all" | SmsKind>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [moderator, setModerator] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sms-messages")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setMessages(d.messages); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const moderatorOptions = useMemo(
    () => Array.from(new Set(messages.map((m) => m.moderator).filter(Boolean))).sort(),
    [messages],
  );
  const recipientOptions = useMemo(
    () => Array.from(new Set(messages.map((m) => m.recipientName))).sort(),
    [messages],
  );

  const filtered = useMemo(() => {
    const startIso = dateRange.start ? toIso(dateRange.start) : null;
    const endIso = dateRange.end ? toIso(dateRange.end) : null;
    return messages.filter((m) => {
      if (tab !== "all" && m.kind !== tab) return false;
      if (startIso && m.date < startIso) return false;
      if (endIso && m.date > endIso) return false;
      if (moderator && m.moderator !== moderator) return false;
      if (recipient && m.recipientName !== recipient) return false;
      if (status && m.status !== status) return false;
      return true;
    });
  }, [messages, tab, dateRange, moderator, recipient, status]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function setFilter(setter: (v: string) => void, v: string) {
    setter(v);
    setPage(1);
  }

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Tablar + filtrlar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-1">
          {SMS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`h-8 px-4 rounded-md text-sm font-medium ${
                tab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <DateRangePicker
            value={dateRange}
            onChange={(r) => { setDateRange(r); setPage(1); }}
            placeholder="Oraliqni tanlang"
          />
          <select value={moderator} onChange={(e) => setFilter(setModerator, e.target.value)} className={`${selectCls} w-44`}>
            <option value="">Moderator</option>
            {moderatorOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={recipient} onChange={(e) => setFilter(setRecipient, e.target.value)} className={`${selectCls} w-48`}>
            <option value="">O&apos;quvchi</option>
            {recipientOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={status} onChange={(e) => setFilter(setStatus, e.target.value)} className={`${selectCls} w-40`}>
            <option value="">Holati</option>
            {SMS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Jadval */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length.toLocaleString("ru-RU")}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left w-56">To&apos;liq ismi</th>
                <th className="px-5 py-3 text-left">Xabar</th>
                <th className="px-5 py-3 text-left w-44">Yaratilgan sanasi</th>
                <th className="px-5 py-3 text-left w-52">Moderator</th>
                <th className="px-5 py-3 text-left pr-5 w-40">Holati</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((m, i) => (
                <tr key={m.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium">{m.recipientName}</td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">
                    <span className="line-clamp-2">{m.text}</span>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-[12px] text-muted-foreground whitespace-nowrap">{formatSmsDate(m)}</td>
                  <td className="px-5 py-3 text-[13px]">{m.moderator || "-"}</td>
                  <td className={`px-5 py-3 pr-5 text-[13px] font-medium ${STATUS_TONE[m.status] ?? ""}`}>{m.status}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
