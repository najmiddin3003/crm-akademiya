"use client";

import { useEffect, useMemo, useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { formatSmsDate, type SmsMessage } from "@/lib/smsMessages";
import type { Order } from "@/lib/ordersData";
import { useT } from "@/components/shared/Language";

// O'quvchi profili → "SMS".
//
// ILGARI NIMA NOTO'G'RI EDI: tab HAR DOIM bitta o'ylab topilgan qatorni
// ko'rsatardi — "ro'yxatdan o'tdingiz" matnli SMS, qattiq yozilgan
// "Qabul qilindi" holati va "Umumiy soni: 1". Hech qanday SMS yuborilmagan
// o'quvchida ham shu qator turardi, holbuki loyihada HAQIQIY SMS jurnali
// bor (/api/sms-messages, MongoDB `sms_messages`, lib/eskiz.ts orqali
// yuborilganda to'ladi) va u hech qachon chaqirilmasdi.
//
// Endi jurnal o'qiladi va shu o'quvchining xabarlari ajratiladi.
// BOG'LANISH KALITI — ISM: `SmsMessage` yozuvida o'quvchi id'si ham,
// telefon raqami ham saqlanmaydi (lib/smsMessages.ts), faqat
// `recipientName` bor. Shu bois bir xil ismli o'quvchilar bir-birining
// xabarini ko'rishi mumkin — bu sxemadagi cheklov (Tranzaksiyalar tabida
// ham xuddi shunday), yozuvga `pupilId` qo'shilsa yopiladi.

const STATUS_TONE: Record<string, string> = {
  "Qabul qilindi": "bg-emerald-50 text-emerald-700",
  Kutilmoqda: "bg-amber-50 text-amber-700",
  Yuborilmadi: "bg-rose-50 text-rose-700",
};

export default function SmsTabContent({ order }: { order: Order }) {
  const { t } = useT();
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sms-messages")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setMessages(d.messages as SmsMessage[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const mine = useMemo(() => {
    const key = order.name.trim().toLowerCase();
    if (!key) return [];
    return messages.filter((m) => (m.recipientName || "").trim().toLowerCase() === key);
  }, [messages, order.name]);

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex justify-end p-3 border-b border-border">
        {/* Ilgari bu yerda literal "Umumiy soni: 1" turardi. */}
        <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">
          Umumiy soni: {loading ? "…" : mine.length}
        </span>
      </div>

      {loading ? (
        <SpinnerBlock />
      ) : mine.length === 0 ? (
        <div className="py-14 text-center">
          <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto text-muted-foreground/40 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
          </svg>
          <div className="text-[14px] font-medium">{t("Xabarlar topilmadi")}</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">{t("Bu o'quvchiga hali SMS yuborilmagan.")}</div>
        </div>
      ) : (
        <div className="table-box">
          <table className="w-full text-sm">
            <thead className="text-[12px] text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">№</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">{t("Yaratilgan sanasi")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("Moderator")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("Holati")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("Xabar")}</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((m, i) => (
                <tr key={m.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 text-[13px]">{i + 1}</td>
                  <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{formatSmsDate(m)}</td>
                  <td className="px-4 py-3 text-[13px]">{m.moderator || "—"}</td>
                  <td className="px-4 py-3 text-[13px]">
                    <span className={`inline-flex items-center h-6 px-2.5 rounded-md text-[12px] font-medium ${STATUS_TONE[m.status] ?? "bg-secondary/50 text-foreground"}`}>
                      {m.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-muted-foreground max-w-[420px] truncate" title={m.text}>{m.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
