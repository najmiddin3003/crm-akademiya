"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, RefreshCw } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import DateField from "@/components/ui/DateField";
import { SpinnerBlock } from "@/components/ui/Spinner";
import type { HandoverReport, HandoverRow } from "@/lib/handoverReport";
import { uzDateIso } from "@/lib/uzTime";
import { useT } from "@/components/shared/Language";

// KUNLIK TOPSHIRUV — rahbar kassa uchun nazorat oynasi (Moliya → Kassalar
// → rahbar kartochkasidagi ro'yxat ikonkasi).
//
// Har qator — bitta filial kassasi: shu kuni qancha yig'di (tushum),
// sarfladi (chiqim) va rahbarga qanchasini jo'natdi (tasdiqlangan /
// kutilayotgan). Raqamlar /api/cashboxes/handover dan
// (lib/handoverReport.ts), FAQAT KO'RSATADI: tasdiqlash jurnaldagi ✓/×
// tugmalarida qoladi. API "farq" va "kassadagi qoldiq"ni ham qaytaradi,
// lekin oynada ko'rsatilmaydi (foydalanuvchi so'rovi, 11.09.2026).
//
// Sana: standart — bugun; ← → bilan kunma-kun yurish, maydonga yozish yoki
// kalendardan tanlash ham mumkin (kassir kechqurun topshirgan bo'lsa
// rahbar ertalab kechagi kunni tekshiradi).

function fmtNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function fmtUz(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export default function HandoverModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const today = uzDateIso();
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<HandoverReport | null>(null);
  const [error, setError] = useState<{ date: string; msg: string } | null>(null);
  // "Yangilash" tugmasi — sana o'zgarmasa ham qayta so'raydi.
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const seqRef = useRef(0);

  // Holat effekt ichida sinxron O'ZGARTIRILMAYDI (react-hooks qoidasi):
  // "yuklanmoqda" — hisobot sanasi tanlangan sanaga mos kelmasligidan
  // kelib chiqadi; javob kelganda holat callback'da yoziladi. Ketma-ket
  // tez bosilganda faqat ENG OXIRGI javob qabul qilinadi.
  useEffect(() => {
    const seq = ++seqRef.current;
    fetch(`/api/cashboxes/handover?date=${date}`)
      .then((r) => r.json())
      .then((j) => {
        if (seq !== seqRef.current) return;
        if (!j.ok) throw new Error(j.error || "Hisobot yuklanmadi");
        setReport(j as HandoverReport);
        setError(null);
      })
      .catch((e: Error) => {
        if (seq !== seqRef.current) return;
        setError({ date, msg: e.message || "Serverga ulanib bo'lmadi" });
      })
      .finally(() => {
        if (seq === seqRef.current) setRefreshing(false);
      });
  }, [date, tick]);

  const errorMsg = error?.date === date ? error.msg : null;
  const loading = !errorMsg && (report?.date !== date || refreshing);
  const rows = report?.date === date ? report.rows : [];
  const tv = report?.date === date ? report.totals : undefined;
  const isToday = date === today;
  const hasActivity = (r: HandoverRow) => r.income > 0 || r.expense > 0 || r.sentAccepted > 0 || r.sentPending > 0;

  const th = "px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap";
  const td = "px-2.5 py-2.5 tabular-nums whitespace-nowrap";

  return (
    <Modal
      onClose={onClose}
      controller={modal}
      size="5xl"
      title={t("Kunlik topshiruv — rahbar kassa")}
      subtitle={t("Filial kassalari shu kuni qancha yig'di, sarfladi va rahbarga qanchasini topshirdi")}
      bodyClassName="p-0"
    >
      {/* Sana boshqaruvi */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-wrap">
        <button
          type="button"
          onClick={() => setDate((d) => shiftDay(d, -1))}
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary"
          title={t("Oldingi kun")}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <DateField value={date} onChange={(v) => v && setDate(v)} variant="compact" className="w-40" />
        <button
          type="button"
          onClick={() => setDate((d) => shiftDay(d, 1))}
          disabled={isToday}
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          title={t("Keyingi kun")}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {!isToday && (
          <button
            type="button"
            onClick={() => setDate(today)}
            className="h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-[13px] font-medium"
          >
            {t("Bugun")}
          </button>
        )}
        <div className="flex-1" />
        {tv && tv.pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 text-[12px] font-medium">
            <Clock className="w-3.5 h-3.5" /> {tv.pendingCount} ta ko&apos;chirma tasdiq kutmoqda
          </span>
        )}
        <button
          type="button"
          onClick={() => { setRefreshing(true); setTick((n) => n + 1); }}
          disabled={loading}
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-50"
          title={t("Yangilash")}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {errorMsg ? (
        <div className="px-5 py-10 text-center text-sm text-rose-600">{errorMsg}</div>
      ) : loading && !tv ? (
        <SpinnerBlock size={28} />
      ) : (
        <div className="table-box in-modal">
          <table className="w-full text-[13px]">
            <thead className="bg-secondary/40">
              <tr>
                <th className={`${th} text-left`}>{t("Kassa")}</th>
                <th className={`${th} text-left`}>{t("Egasi")}</th>
                <th className={`${th} text-right`}>{t("Tushum")}</th>
                <th className={`${th} text-right`}>{t("Chiqim")}</th>
                <th className={`${th} text-right`} title={t("Tushum − Chiqim")}>{t("Topshirishi kerak")}</th>
                <th className={`${th} text-right`}>{t("Jo'natdi")}</th>
                <th className={`${th} text-right text-emerald-700 dark:text-emerald-400`}>{t("✓ Tasdiqlangan")}</th>
                <th className={`${th} text-right text-amber-700 dark:text-amber-400`}>{t("⏳ Kutilmoqda")}</th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-60" : ""}>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{t("Filial kassalari yo'q")}</td>
                </tr>
              )}
              {rows.map((r) => {
                const active = hasActivity(r);
                const sent = r.sentAccepted + r.sentPending;
                return (
                  <tr key={r.cashboxId} className={`border-t border-border/60 ${active ? "" : "text-muted-foreground"}`}>
                    <td className={`${td} font-medium`}>{r.name}</td>
                    <td className={td}>{r.moderator || <span className="text-muted-foreground">{t("mas'ul belgilanmagan")}</span>}</td>
                    <td className={`${td} text-right`}>{active ? fmtNum(r.income) : "—"}</td>
                    <td className={`${td} text-right`}>{active ? fmtNum(r.expense) : "—"}</td>
                    <td className={`${td} text-right font-medium`}>{active ? fmtNum(r.mustSend) : "—"}</td>
                    <td className={`${td} text-right`}>{active ? fmtNum(sent) : "—"}</td>
                    <td className={`${td} text-right ${r.sentAccepted > 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>{active ? fmtNum(r.sentAccepted) : "—"}</td>
                    <td className={`${td} text-right ${r.sentPending > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}`}>
                      {active ? fmtNum(r.sentPending) : "—"}
                      {r.pendingCount > 0 && <span className="ml-1 text-[11px] text-amber-700/80">({r.pendingCount})</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {tv && rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                  <td className={td} colSpan={2}>{t("Jami")}</td>
                  <td className={`${td} text-right`}>{fmtNum(tv.income)}</td>
                  <td className={`${td} text-right`}>{fmtNum(tv.expense)}</td>
                  <td className={`${td} text-right`}>{fmtNum(tv.mustSend)}</td>
                  <td className={`${td} text-right`}>{fmtNum(tv.sentAccepted + tv.sentPending)}</td>
                  <td className={`${td} text-right text-emerald-700 dark:text-emerald-400`}>{fmtNum(tv.sentAccepted)}</td>
                  <td className={`${td} text-right text-amber-700 dark:text-amber-400`}>{fmtNum(tv.sentPending)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <div className="px-5 py-3 border-t border-border text-[12px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span><b className="font-semibold text-foreground">{fmtUz(date)}</b>{" "}{t("uchun, jurnaldagi sana bo'yicha")}</span>
        <span>{t("Topshirishi kerak = Tushum − Chiqim")}</span>
        <span>{t("Tasdiqlash — jurnaldagi ✓ / × tugmalarida")}</span>
      </div>
    </Modal>
  );
}
