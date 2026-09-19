"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  RotateCw,
  Send,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import type { ReconcileReport, SyncKind, SyncRunDoc, SyncTask } from "@/lib/sync/types";
import { toUz } from "@/lib/uzTime";
import { useT } from "@/components/shared/Language";

// Moliya → Sinxronizatsiya (sidebar: Moliya > Sinxronizatsiya, href
// /finance-sync).
//
// Kelishuv bo'yicha kunlik tekshiruv natijasi Telegram'ga YUBORILMAYDI —
// u faqat shu sahifada ko'rinadi. Shuning uchun sahifa "hammasi joyidami?"
// degan savolga bir qarashda javob berishi kerak: yuqorida umumiy holat,
// pastda esa muammoli yozuvlar va tekshiruvlar tarixi.

interface TargetState {
  label: string;
  sheetReady: boolean;
  telegramReady: boolean;
  /** Bu oqim guruhga HAR BIR YOZUV uchun ketadimi. */
  telegramUsed: boolean;
  /** Bo'sh bo'lmasa — Telegram o'rniga shu izoh ko'rsatiladi. */
  telegramNote: string;
  /** Guruh ichidagi topic raqami — bo'sh bo'lsa umumiy oqim. */
  threadId: string;
  tabName: string;
}

interface StatusResponse {
  ok: boolean;
  config: {
    enabled: boolean;
    issues: string[];
    targets: Record<SyncKind, TargetState>;
  };
  counts: { pending: number; failed: number; done: number; oldestPendingAt: string | null };
  problems: SyncTask[];
  runs: SyncRunDoc[];
}

function fmtStamp(iso: string | null): string {
  if (!iso) return "—";
  const raw = new Date(iso);
  if (Number.isNaN(raw.getTime())) return "—";
  // Har doim O'zbekiston vaqti — brauzer boshqa zonada bo'lsa ham.
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const KIND_LABEL: Record<string, string> = {
  payment: "To'lov",
  salary: "Oylik",
  expense: "Xarajat",
  transfer: "Ko'chirma",
};

/** Manzil kartochkalari va tarix ustunlari shu tartibda. */
const KINDS: SyncKind[] = ["payment", "salary", "expense", "transfer"];

const EVENT_LABEL: Record<string, string> = {
  created: "Yangi",
  cancelled: "Bekor qilindi",
};

/** Bitta hisobotni odam o'qiydigan qatorga aylantiradi. */
function summarize(r: ReconcileReport): string {
  if (r.errors.length > 0) return r.errors[0];
  const parts: string[] = [];
  if (r.added) parts.push(`${r.added} qo'shildi`);
  if (r.updated) parts.push(`${r.updated} yangilandi`);
  if (r.duplicates) parts.push(`${r.duplicates} dublikat o'chirildi`);
  if (r.orphans) parts.push(`${r.orphans} begona qator`);
  if (r.remaining) parts.push(`${r.remaining} qoldi`);
  if (parts.length === 0) return `${r.dbCount}/${r.dbCount} sinxron`;
  return parts.join(", ");
}

export default function SyncPage() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  /** Amaldan keyin holatni yangilash uchun (tugmalar chaqiradi). */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sync");
      const d = (await res.json()) as StatusResponse;
      if (d.ok) setData(d);
      else showError(t("Holat o'qilmadi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    }
  }, [showError, t]);

  // Birinchi yuklash — loyihadagi odatiy naqsh (PlannedExpensesPage kabi):
  // effekt ichida setState sinxron chaqirilmaydi, faqat promise javob
  // bergach. `cancelled` — komponent yopilgach setState qilmaslik uchun.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sync")
      .then((r) => r.json())
      .then((d: StatusResponse) => {
        if (!cancelled && d.ok) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(action: "retry" | "reconcile" | "test") {
    setBusy(action);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!d.ok) {
        showError(t(d.error || "Amal bajarilmadi"));
      } else if (action === "test") {
        if (d.bot?.ok) showSuccess(t("Bot ishlayapti: @{username}", { username: d.bot.username }));
        else showError(t(d.bot?.error || "Bot javob bermadi"));
      } else if (action === "retry") {
        showSuccess(t("Qayta yuborildi: {succeeded} ta, xato: {failed} ta", { succeeded: d.flush.succeeded, failed: d.flush.failed }));
      } else {
        const added = (d.reports as ReconcileReport[]).reduce((s, r) => s + r.added, 0);
        const updated = (d.reports as ReconcileReport[]).reduce((s, r) => s + r.updated, 0);
        showSuccess(added + updated === 0 ? "Hammasi sinxron" : t("{added} qo'shildi, {updated} yangilandi", { added, updated }));
      }
      await load();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setBusy(null);
    }
  }

  const counts = data?.counts;
  const problems = data?.problems ?? [];
  const runs = data?.runs ?? [];
  const issues = data?.config.issues ?? [];
  const lastRun = runs[0] ?? null;
  const healthy = Boolean(
    data && issues.length === 0 && counts && counts.pending === 0 && counts.failed === 0,
  );

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-[18px] font-semibold">{t("Sinxronizatsiya")}</h1>
        <div className="inline-flex items-center gap-2">
          <button
            onClick={() => act("test")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            {t("Ulanishni tekshirish")}
          </button>
          <button
            onClick={() => act("retry")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
          >
            <RotateCw className={`w-4 h-4 ${busy === "retry" ? "animate-spin" : ""}`} />
            {t("Qayta yuborish")}
          </button>
          <button
            onClick={() => act("reconcile")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${busy === "reconcile" ? "animate-spin" : ""}`} />
            {t("To'liq tekshirish")}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="rounded-xl border border-border bg-card p-10 flex justify-center">
          <SpinnerBlock size={22} />
        </div>
      ) : (
        <>
          {/* Umumiy holat */}
          <div
            className={`rounded-xl border p-4 flex items-start gap-3 ${
              healthy
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/30 bg-amber-500/5"
            }`}
          >
            {healthy ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">
                {healthy ? t("Hammasi sinxron") : t("E'tibor talab qilinadi")}
              </p>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Oxirgi tekshiruv: {fmtStamp(lastRun?.finishedAt ?? null)}
                {lastRun ? ` · ${lastRun.trigger === "cron" ? t("jadval bo'yicha") : t("qo'lda")}` : ""}
              </p>
              {issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {issues.map((it) => (
                    <li key={it} className="text-[13px] text-amber-700 dark:text-amber-500">
                      • {it}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Raqamlar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t("Navbatda"), value: counts?.pending ?? 0, tone: "text-amber-600" },
              { label: t("Xatolik bilan"), value: counts?.failed ?? 0, tone: "text-rose-600" },
              { label: t("Yuborilgan"), value: counts?.done ?? 0, tone: "text-emerald-600" },
              {
                label: t("Eng eski kutayotgan"),
                value: counts?.oldestPendingAt ? fmtStamp(counts.oldestPendingAt) : "—",
                tone: "text-muted-foreground",
                small: true,
              },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(c.label)}
                </p>
                <p className={`mt-1 font-bold tabular-nums ${c.tone} ${c.small ? "text-[13px]" : "text-[22px]"}`}>
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          {/* Manzillar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {KINDS.map((kind) => {
              const tv = data?.config.targets[kind];
              if (!tv) return null;
              return (
                <div key={kind} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-[14px] font-semibold">{t(tv.label)}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Varaq: {tv.tabName}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-[13px]">
                      {tv.sheetReady ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                      Google Sheets
                    </span>
                    {/* Har bir yozuv uchun xabar ketmaydigan oqimlarda
                        qizil ✗ chiqsa "buzuq" degan taassurot qolardi.
                        Oyliklar bundan ham nozik: u guruhga BORADI, lekin
                        oyda ikki marta xulosa bo'lib — shuni aytamiz. */}
                    <span className="inline-flex items-center gap-1.5 text-[13px]">
                      {!tv.telegramUsed ? (
                        <span className="text-muted-foreground">
                          Telegram: {tv.telegramNote || "kerak emas"}
                        </span>
                      ) : (
                        <>
                          {tv.telegramReady ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-500" />
                          )}
                          Telegram
                          {tv.threadId && (
                            <span className="text-muted-foreground">· topic {tv.threadId}</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Muammoli yozuvlar */}
          <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-4 pt-4 pb-2">
              <p className="text-[14px] font-semibold">{t("Yuborilmagan yozuvlar")}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {t("Bular yo'qolmagan — navbatda turibdi va keyingi urinishda yuboriladi.")}
              </p>
            </div>
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left px-3 py-3 whitespace-nowrap w-20">ID</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Oqim")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Hodisa")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Sheets")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Telegram")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Urinish")}</th>
                    <th className="text-left px-3 py-3">{t("Xato")}</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((p) => (
                    <tr key={`${p.kind}-${p.entryId}-${p.event}`} className="border-b border-border/50">
                      <td className="px-3 py-3 tabular-nums text-[13px] font-medium">#{p.entryId}</td>
                      <td className="px-3 py-3 text-[13px]">{KIND_LABEL[p.kind] || p.kind}</td>
                      <td className="px-3 py-3 text-[13px]">{EVENT_LABEL[p.event] || p.event}</td>
                      <td className="px-3 py-3 text-[13px]">{p.sheetDone ? "✅" : "—"}</td>
                      <td className="px-3 py-3 text-[13px]">
                        {p.telegramDone ? "✅" : p.notifyTelegram ? "—" : "kerak emas"}
                      </td>
                      <td className="px-3 py-3 text-[13px] tabular-nums">{p.attempts}</td>
                      <td className="px-3 py-3 text-[12px] text-rose-600 max-w-[380px] truncate" title={p.lastError || ""}>
                        {p.lastError || "—"}
                      </td>
                    </tr>
                  ))}
                  {problems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        {t("Navbat bo'sh — hamma yozuv yuborilgan")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tekshiruvlar tarixi */}
          <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-4 pt-4 pb-2">
              <p className="text-[14px] font-semibold">{t("Tekshiruvlar tarixi")}</p>
            </div>
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Vaqt")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Kim")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Navbat")}</th>
                    {KINDS.map((k) => (
                      <th key={k} className="text-left px-3 py-3">{KIND_LABEL[k]}</th>
                    ))}
                    <th className="text-left px-3 py-3 whitespace-nowrap w-20">{t("Holat")}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    return (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="px-3 py-3 text-[13px] whitespace-nowrap">{fmtStamp(r.finishedAt || r.startedAt)}</td>
                        <td className="px-3 py-3 text-[13px]">{r.trigger === "cron" ? t("Jadval") : t("Qo'lda")}</td>
                        <td className="px-3 py-3 text-[13px] tabular-nums">
                          {r.flushed}
                          {r.flushFailed > 0 && <span className="text-rose-600"> / {r.flushFailed} xato</span>}
                        </td>
                        {KINDS.map((k) => {
                          const rep = r.reports.find((x) => x.kind === k);
                          return (
                            <td key={k} className="px-3 py-3 text-[12px]">{rep ? summarize(rep) : "—"}</td>
                          );
                        })}
                        <td className="px-3 py-3 text-[13px]">{r.ok ? "✅" : "⚠️"}</td>
                      </tr>
                    );
                  })}
                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={3 + KINDS.length + 1} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        {t("Hali tekshiruv o'tkazilmagan")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
