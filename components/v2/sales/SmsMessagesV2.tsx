"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Info, MessageSquareText, RefreshCw, X } from "lucide-react";
import Link from "@/components/ui/Link";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { useLang, useT } from "@/components/shared/Language";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import { B, Badge, NoticeBar, PageHead, PageShell, SegmentPills, SummaryLine, TH, fmtNum, fmtPhone, type BadgeTone } from "@/components/v2/students/lists/listKit";
import StaffName from "@/components/v2/ui/StaffName";
import V2DateRange, { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { SMS_STATUSES, SMS_TABS, formatSmsDate, smsChannelLabel, smsPurposeLabel, type SmsKind, type SmsMessage } from "@/lib/smsMessages";

// YANGI VERSIYA — SOTUV VA MARKETING → «XABARLAR RO'YHATI» (/sales-messages, rasmsiz — 53-qism, 20.11.2026).
// Eski versiyada — components/sales/SmsMessagesPage.tsx, o'zgarmagan.
//
// Sof jurnal (faqat ko'rish): GET /api/sms-messages — eski sahifa bilan bitta manba. Filtrlar eskisidagi
// to'rttasi (tur tablari, sana oralig'i, Moderator, O'quvchi, Holati) va o'sha shartlar bilan — brauzerda.
// Yangisi faqat ko'rinishda: tablarda son, xulosa qatori (holatlar bo'yicha), qatorda telefon, xabar
// sababi (`purpose` · kassa) va «Yuborilmadi» sababi (`providerError`) — hammasi o'sha javobda bor edi.
//
// «Avto sms» tabi uchun eski izoh («bu turdagi yozuv umuman yaratilmaydi») ESKIRGAN: to'lov xabari
// (bot), xodim taklifi va parol tiklash `kind: "auto"` bilan yoziladi (lib/smsLog.ts) — bu yerda
// ko'rsatilmaydi. «Guruhlangan sms» izohi hali to'g'ri — har SMS oynasi (ommaviy ham) har raqamga
// alohida so'rov yuboradi va «qo'lda» deb yozadi.

type SalesSmsMsgTab = "all" | SmsKind;

const SALES_SMS_MSG_TONE: Record<string, BadgeTone> = {
  "Qabul qilindi": "success",
  Kutilmoqda: "warning",
  Yuborilmadi: "danger",
};

function salesSmsMsgIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function salesSmsMsgDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

const SALES_SMS_MSG_TD = "px-2.5 py-2.5 align-middle";
const SALES_SMS_MSG_COLS = 7;

export default function SmsMessagesV2() {
  const { t } = useT();
  const [lang] = useLang();
  const canAuto = useCanOpen("/sales-auto-messages");

  const [messages, setMessages] = useState<SmsMessage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const [tab, setTab] = useState<SalesSmsMsgTab>("all");
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
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setMessages(d.messages);
          setFailed(false);
        } else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const all = useMemo(() => messages ?? [], [messages]);
  const moderatorOptions = useMemo(
    () => Array.from(new Set(all.map((m) => m.moderator).filter(Boolean))).sort().map((m) => ({ value: m, label: m })),
    [all],
  );
  const recipientOptions = useMemo(
    () => Array.from(new Set(all.map((m) => m.recipientName))).sort().filter(Boolean).map((r) => ({ value: r, label: r })),
    [all],
  );

  // Filtr — eski sahifadagi bilan aynan bir xil shartlar.
  const filtered = useMemo(() => {
    const startIso = dateRange.start ? salesSmsMsgIso(dateRange.start) : null;
    const endIso = dateRange.end ? salesSmsMsgIso(dateRange.end) : null;
    return all.filter((m) => {
      if (tab !== "all" && m.kind !== tab) return false;
      if (startIso && m.date < startIso) return false;
      if (endIso && m.date > endIso) return false;
      if (moderator && m.moderator !== moderator) return false;
      if (recipient && m.recipientName !== recipient) return false;
      if (status && m.status !== status) return false;
      return true;
    });
  }, [all, tab, dateRange, moderator, recipient, status]);

  const statusCount = (s: string) => filtered.filter((m) => m.status === s).length;
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const groupedNote = tab === "grouped";
  const anyFilter = !!(dateRange.start || dateRange.end || moderator || recipient || status);
  const on = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const clearAll = () => {
    setDateRange({ start: null, end: null });
    setModerator("");
    setRecipient("");
    setStatus("");
    setPage(1);
  };

  return (
    <PageShell>
      <PageHead
        title={t("Xabarlar ro'yhati")}
        subtitle={t("SMS va Telegram bot orqali yuborilgan xabarlar jurnali · faqat ko'rish")}
        actions={
          canAuto ? (
            <Link href="/sales-auto-messages" className={secondaryBtn}>
              {t("Avtomatik xabarlar")}
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          ) : undefined
        }
      />

      {/* Tur tablari */}
      <SegmentPills<SalesSmsMsgTab>
        items={SMS_TABS.map((tv) => ({ key: tv.key, label: t(tv.label), count: tv.key === "all" ? all.length : all.filter((m) => m.kind === tv.key).length }))}
        value={tab}
        onChange={on(setTab)}
      />

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <V2DateRange value={dateRange} onChange={on(setDateRange)} align="start" />
        <V2Select variant="chip" label={t("Moderator")} value={moderator} onChange={on(setModerator)} options={moderatorOptions} searchable="auto" />
        <V2Select variant="chip" label={t("O'quvchi")} value={recipient} onChange={on(setRecipient)} options={recipientOptions} searchable />
        <V2Select variant="chip" label={t("Holati")} value={status} onChange={on(setStatus)} options={SMS_STATUSES.map((s) => ({ value: s, label: s }))} searchable={false} />
        {anyFilter && (
          <button type="button" onClick={clearAll} className="inline-flex h-9 items-center gap-1 rounded-v2-md px-2 text-v2-small text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
            <X className="size-3.5" strokeWidth={2} aria-hidden />
            {t("Tozalash")}
          </button>
        )}
      </div>

      {/* Bo'sh tabning rost sababi — filtr aybdor emasligi darrov ko'rinsin. */}
      {groupedNote && (
        <NoticeBar>
          {t("Guruhga bir yo'la yuborish oqimi hali yo'q: SMS oynalari (ommaviy SMS ham) har raqamga alohida yuboradi va jurnalga «qo'lda yuborilgan» turi bilan yozadi. Shu sababli bu turdagi yozuv hozircha yaratilmaydi.")}
        </NoticeBar>
      )}

      <SummaryLine
        items={[
          <span key="n">
            {t("Umumiy soni:")} <B>{messages ? fmtNum(filtered.length) : "—"}</B>
          </span>,
          messages ? (
            <span key="ok">
              {t("Qabul qilindi")}: <B tone="success">{fmtNum(statusCount("Qabul qilindi"))}</B>
            </span>
          ) : null,
          messages ? (
            <span key="fail">
              {t("Yuborilmadi")}: <B tone={statusCount("Yuborilmadi") ? "danger" : undefined}>{fmtNum(statusCount("Yuborilmadi"))}</B>
            </span>
          ) : null,
          messages && statusCount("Kutilmoqda") ? (
            <span key="wait">
              {t("Kutilmoqda")}: <B>{fmtNum(statusCount("Kutilmoqda"))}</B>
            </span>
          ) : null,
        ]}
      />

      {/* Jadval */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[1040px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} w-14 pl-4`}>№</th>
                <th className={`${TH} w-56`}>{t("To'liq ismi")}</th>
                <th className={TH}>{t("Xabar")}</th>
                <th className={`${TH} w-36`}>{t("Yaratilgan sanasi")}</th>
                <th className={`${TH} w-32`}>{t("Kanal")}</th>
                <th className={`${TH} w-44`}>{t("Moderator")}</th>
                <th className={`${TH} w-44 pr-4`}>{t("Holati")}</th>
              </tr>
            </thead>
            <tbody>
              {!messages &&
                !failed &&
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-14 border-b border-v2-border" aria-hidden>
                    <td className={`${SALES_SMS_MSG_TD} pl-4`}><div className="h-3 w-6 rounded bg-v2-skeleton" /></td>
                    <td className={SALES_SMS_MSG_TD}>
                      <div className="space-y-1.5">
                        <div className="h-3 w-32 rounded bg-v2-skeleton" />
                        <div className="h-2.5 w-20 rounded bg-v2-skeleton" />
                      </div>
                    </td>
                    <td className={SALES_SMS_MSG_TD}><div className="h-3 w-72 rounded bg-v2-skeleton" /></td>
                    <td className={SALES_SMS_MSG_TD}><div className="h-3 w-20 rounded bg-v2-skeleton" /></td>
                    <td className={SALES_SMS_MSG_TD}><div className="h-5 w-14 rounded-v2-full bg-v2-skeleton" /></td>
                    <td className={SALES_SMS_MSG_TD}><div className="h-3 w-24 rounded bg-v2-skeleton" /></td>
                    <td className={`${SALES_SMS_MSG_TD} pr-4`}><div className="h-5 w-20 rounded-v2-full bg-v2-skeleton" /></td>
                  </tr>
                ))}

              {(failed && !messages) || (messages && slice.length === 0) ? (
                <tr>
                  <td colSpan={SALES_SMS_MSG_COLS} className="p-5">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <MessageSquareText className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {failed && !messages ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotni yuklab bo'lmadi")}</div>
                          <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-2`}>
                            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                            {t("Qayta urinish")}
                          </button>
                        </>
                      ) : groupedNote ? (
                        // Filtrni o'zgartirish yordam bermaydi — bu turdagi xabar umuman yozilmaydi.
                        <div className="text-v2-section text-v2-text">{t("Bu turdagi xabarlar hali yaratilmaydi")}</div>
                      ) : anyFilter ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.")}</div>
                          <button type="button" onClick={clearAll} className={`${secondaryBtn} mt-2`}>
                            {t("Filtrlarni tozalash")}
                          </button>
                        </>
                      ) : (
                        <div className="text-v2-section text-v2-text">{t("Hali xabar yuborilmagan")}</div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}

              {slice.map((m, i) => {
                const d = salesSmsMsgDate(m.date);
                const phone = m.phone ? fmtPhone(m.phone) : "";
                const purpose = m.purpose ? t(smsPurposeLabel(m.purpose)) : "";
                const why = [purpose, m.cashboxName].filter(Boolean).join(" · ");
                const telegram = m.channel === "telegram";
                return (
                  <tr key={m.id} className={`border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                    <td className={`${SALES_SMS_MSG_TD} pl-4 tabular-nums text-v2-text-3`}>{start + i + 1}</td>
                    <td className={`${SALES_SMS_MSG_TD} max-w-[224px]`}>
                      <span className="block truncate font-semibold text-v2-text" title={m.recipientName}>
                        {m.recipientName || <span className="font-normal text-v2-text-3">—</span>}
                      </span>
                      {phone && <span className="block truncate text-v2-small tabular-nums text-v2-text-3">{phone}</span>}
                    </td>
                    <td className={`${SALES_SMS_MSG_TD} min-w-[260px]`}>
                      <span className="line-clamp-2 text-v2-small text-v2-text-2" title={m.text}>
                        {m.text}
                      </span>
                      {why && <span className="mt-0.5 block truncate text-v2-caption text-v2-text-3">{why}</span>}
                    </td>
                    <td className={`${SALES_SMS_MSG_TD} whitespace-nowrap tabular-nums text-v2-text-2`} title={formatSmsDate(m)}>
                      {d ? dayMonthLabel(d, lang) : m.date || "—"}
                      {m.time && (
                        <>
                          {" "}
                          <span className="text-v2-text-3">|</span> {m.time}
                        </>
                      )}
                    </td>
                    <td className={`${SALES_SMS_MSG_TD} whitespace-nowrap`}>
                      <Badge tone={telegram ? "info" : "neutral"}>{t(smsChannelLabel(m.channel))}</Badge>
                    </td>
                    <td className={`${SALES_SMS_MSG_TD} max-w-[176px] truncate text-v2-text`}>
                      <StaffName name={m.moderator || ""} />
                    </td>
                    <td className={`${SALES_SMS_MSG_TD} max-w-[176px] pr-4`}>
                      {m.status ? <Badge tone={SALES_SMS_MSG_TONE[m.status] ?? "neutral"}>{t(m.status)}</Badge> : <span className="text-v2-text-3">—</span>}
                      {m.status === "Yuborilmadi" && m.providerError && (
                        <span className="mt-0.5 block truncate text-v2-caption text-v2-danger" title={m.providerError}>
                          {m.providerError}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <V2Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>

      <p className="flex items-start gap-2 text-v2-caption text-v2-text-2">
        <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
        <span>{t("«Qabul qilindi» — operator (Eskiz) yoki Telegram bot xabarni qabul qildi; telefonga yetib borgani alohida tekshirilmaydi. Parol va bir martalik kodli xabarlar matni jurnalga yozilmaydi.")}</span>
      </p>
    </PageShell>
  );
}
