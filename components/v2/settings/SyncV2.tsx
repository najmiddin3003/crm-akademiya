"use client";

import { useState } from "react";
import { ArrowLeftRight, Banknote, Check, CheckCircle2, CircleAlert, CircleMinus, Clock, History, Loader2, RefreshCw, Sheet, Wallet } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar, TH, fmtNum } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import type { ReconcileReport, SyncKind, SyncRunDoc, SyncTask } from "@/lib/sync/types";

// YANGI VERSIYA — MOLIYA → «GOOGLE SHEETS VA TELEGRAM» (39-qism, rasm «Sinxronizatsiya»). Eski Sinxronizatsiya
// sahifasi bilan bir backend (/api/sync): holat banneri, navbat ko'rsatkichlari, oqimlar (Sheets varag'i, Telegram,
// oxirgi yozuv), yuborilmagan yozuvlar va tekshiruvlar tarixi. Tugmalar: «Ulanishni tekshirish» (bot), «Qayta
// yuborish» (navbat), «To'liq tekshirish» (jadval bilan solishtirish). Oqimlarni yoqish/o'chirish server sozlamasida
// (muhit o'zgaruvchilari) — sahifada faqat holati ko'rinadi.

type Target = { label: string; sheetReady: boolean; telegramReady: boolean; telegramUsed: boolean; telegramNote: string; threadId: number | null; tabName: string };
type Data = {
  ok: true;
  config: { enabled: boolean; issues: string[]; targets: Record<SyncKind, Target> };
  counts: { pending: number; failed: number; done: number; oldestPendingAt: string | null };
  problems: SyncTask[];
  runs: SyncRunDoc[];
  lastDone?: Partial<Record<SyncKind, string>>;
};

const KINDS: SyncKind[] = ["payment", "salary", "expense", "transfer"];
const KIND_ICON: Record<SyncKind, typeof Wallet> = { payment: Wallet, salary: Banknote, expense: CircleMinus, transfer: ArrowLeftRight };
const EVENT: Record<string, string> = { created: "yangi", cancelled: "bekor qilindi", confirmed: "tasdiqlandi" };
const SHORT: Record<SyncKind, string> = { payment: "To'lov", salary: "Oylik", expense: "Xarajat", transfer: "Ko'chirma" };

function Kpi({ label, value, sub, tone, small }: { label: string; value: string; sub: string; tone?: "danger" | "warning"; small?: boolean }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="text-v2-small text-v2-text-2">{label}</div>
      <div className={`mt-1 ${small ? "text-[17px] leading-[30px]" : "text-[24px]"} font-semibold tabular-nums ${tone === "danger" ? "text-v2-danger" : tone === "warning" ? "text-v2-warning" : "text-v2-text"}`}>{value}</div>
      <div className="text-v2-small text-v2-text-2">{sub}</div>
    </div>
  );
}

function reportOf(run: SyncRunDoc, k: SyncKind): ReconcileReport | undefined {
  return run.reports.find((r) => r.kind === k);
}

export default function SyncV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<Data>("/api/sync");
  const [busy, setBusy] = useState<"" | "test" | "retry" | "reconcile">("");

  const stamp = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const x = new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString();
    return fmt.stamp(x.slice(0, 10), x.slice(11, 16));
  };

  async function act(action: "test" | "retry" | "reconcile") {
    setBusy(action);
    const r = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy("");
    if (!r?.ok) return showError(t(r?.error || "Bajarib bo'lmadi"));
    if (action === "test") {
      const bot = r.bot as { ok?: boolean; username?: string; error?: string } | undefined;
      if (bot?.ok) showSuccess(t("Bot ulangan: @{u}", { u: bot.username ?? "" }));
      else showError(t("Bot javob bermadi: {e}", { e: bot?.error ?? "" }));
    } else showSuccess(action === "retry" ? t("Navbat qayta yuborildi") : t("Tekshiruv tugadi"));
    reload();
  }

  if (error) return <div className="p-6"><NoticeBar>{t("Ma'lumotni yuklab bo'lmadi")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const last = d.runs[0];
  const queue = d.counts.pending + d.counts.failed;
  const state: "off" | "ok" | "queue" | "error" = !d.config.enabled ? "off" : d.counts.failed > 0 || (last && !last.ok) ? "error" : queue > 0 ? "queue" : "ok";
  const banner = {
    off: { cls: "bg-v2-surface-2 text-v2-text-2", icon: CircleAlert, title: t("Sinxronizatsiya o'chirilgan") },
    ok: { cls: "bg-v2-success-bg text-v2-success", icon: CheckCircle2, title: t("Hammasi sinxron") },
    queue: { cls: "bg-v2-info-bg text-v2-info", icon: Clock, title: t("{n} ta yozuv navbatda", { n: queue }) },
    error: { cls: "bg-v2-warning-bg text-v2-warning", icon: CircleAlert, title: t("Yuborilmagan yozuvlar bor") },
  }[state];
  const BIcon = banner.icon;

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-v2-small text-v2-text-2">{t("Integratsiyalar")}</div>
          <h1 className="text-v2-page text-v2-text">{t("Google Sheets va Telegram")}</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("To'lov, oylik, xarajat va ko'chirmalar Google Sheets jadvaliga yoziladi, muhimlari Telegram'ga xabar bo'lib boradi. Har kecha hammasi jadval bilan solishtiriladi.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={() => void act("test")} className={`${secondaryBtn} disabled:opacity-60`}>
            {busy === "test" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />} {t("Ulanishni tekshirish")}
          </button>
          <button type="button" disabled={!!busy || !d.config.enabled} onClick={() => void act("reconcile")} className={`${primaryBtn} disabled:opacity-60`}>
            {busy === "reconcile" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />} {t("To'liq tekshirish")}
          </button>
        </div>
      </div>
      <section className={`flex flex-wrap items-center gap-3 rounded-v2-lg px-4 py-3 ${banner.cls}`}>
        <BIcon className="size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{banner.title}</div>
          <div className="text-v2-small text-v2-text-2">
            {state === "off" ? d.config.issues.join(" · ") || t("Server sozlamasida yoqilmagan") : last ? t("Oxirgi tekshiruv: {at} · {who}", { at: stamp(last.startedAt), who: last.trigger === "cron" ? t("jadval bo'yicha") : t("qo'lda") }) : t("Hali tekshiruv bo'lmagan")}
          </div>
        </div>
        {d.config.enabled && (
          <button type="button" disabled={!!busy || queue === 0} onClick={() => void act("retry")} className={`${secondaryBtn} disabled:opacity-60`}>
            {busy === "retry" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />} {t("Qayta yuborish")}
          </button>
        )}
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t("Navbatda")} value={fmtNum(d.counts.pending)} sub={t("yuborilishini kutayotgan yozuv")} tone={d.counts.pending ? "warning" : undefined} />
        <Kpi label={t("Xatolik bilan")} value={fmtNum(d.counts.failed)} sub={t("bir necha marta urinib bo'lmagan")} tone={d.counts.failed ? "danger" : undefined} />
        <Kpi label={t("Yuborilgan")} value={fmtNum(d.counts.done)} sub={t("jami yozuv")} />
        <Kpi small label={t("Eng eski kutayotgan")} value={d.counts.oldestPendingAt ? stamp(d.counts.oldestPendingAt) : "—"} sub={d.counts.oldestPendingAt ? t("navbatdagi eng eski yozuv") : t("navbat bo'sh")} />
      </section>
      <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-success-bg text-v2-success">
            <Sheet className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-v2-text">{t("Oqimlar")}</h2>
            <p className="text-v2-small text-v2-text-2">{t("Har oqim o'z varag'iga yoziladi")}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-v2-small">
            <thead>
              <tr className="border-b border-v2-border">
                <th className={TH}>{t("Oqim")}</th>
                <th className={TH}>{t("Google Sheets varag'i")}</th>
                <th className={TH}>Telegram</th>
                <th className={`${TH} text-right`}>{t("Oxirgi yozuv")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-v2-border">
              {KINDS.map((k) => {
                const x = d.config.targets[k];
                const Icon = KIND_ICON[k];
                return (
                  <tr key={k}>
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2 font-semibold text-v2-text">
                        <Icon className="size-4 text-v2-text-2" aria-hidden /> {t(x.label)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">{x.sheetReady ? <span className="text-v2-text">«{x.tabName}»</span> : <span className="rounded-full bg-v2-warning-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-warning">{t("sozlanmagan")}</span>}</td>
                    <td className="py-2.5 pr-3 text-v2-text-2">{x.telegramNote ? t(x.telegramNote) : x.telegramReady ? t("har yozuv — guruhga") + (x.threadId ? ` · topic ${x.threadId}` : "") : <span className="text-v2-warning">{t("guruh sozlanmagan")}</span>}</td>
                    <td className="py-2.5 text-right tabular-nums text-v2-text">{stamp(d.lastDone?.[k])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-surface-2 text-v2-text-2">
            <Clock className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-v2-text">{t("Yuborilmagan yozuvlar")}</h2>
            <p className="text-v2-small text-v2-text-2">{t("Yozuv yo'qolmaydi: xato bo'lsa navbatda turadi va keyingi urinishda yuboriladi")}</p>
          </div>
        </div>
        {d.problems.length ? (
          <ul className="divide-y divide-v2-border rounded-v2-md border border-v2-border">
            {d.problems.slice(0, 20).map((p) => (
              <li key={`${p.kind}-${p.entryId}-${p.event}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-v2-small">
                <span className="font-semibold text-v2-text">
                  {t(SHORT[p.kind])} #{p.entryId}
                </span>
                <span className="text-v2-text-2">{t(EVENT[p.event] ?? p.event)}</span>
                <span className="text-v2-text-2">{t("{n} marta urinildi", { n: p.attempts })}</span>
                <span className="min-w-0 flex-1 truncate text-v2-text-3" title={p.lastError ?? ""}>
                  {p.lastError ?? ""}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-v2-caption font-semibold ${p.status === "failed" ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-warning-bg text-v2-warning"}`}>{p.status === "failed" ? t("xato") : t("navbatda")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-v2-md border border-dashed border-v2-border py-8 text-v2-small text-v2-text-2">
            <CheckCircle2 className="size-4 text-v2-success" aria-hidden /> {t("Navbat bo'sh — hamma yozuv yuborilgan")}
          </div>
        )}
      </section>
      <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-info-bg text-v2-info">
            <History className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-v2-text">{t("Tekshiruvlar tarixi")}</h2>
            <p className="text-v2-small text-v2-text-2">{t("Har tekshiruvda jadval baza bilan solishtiriladi va farqlar tuzatiladi")}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-v2-small">
            <thead>
              <tr className="border-b border-v2-border">
                <th className={TH}>{t("Vaqt")}</th>
                <th className={TH}>{t("Kim")}</th>
                <th className={`${TH} text-right`}>{t("Navbat")}</th>
                {KINDS.map((k) => (
                  <th key={k} className={`${TH} text-center`}>
                    {t(SHORT[k])}
                  </th>
                ))}
                <th className={`${TH} text-right`}>{t("Holat")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-v2-border">
              {d.runs.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 pr-3 tabular-nums text-v2-text">{stamp(r.startedAt)}</td>
                  <td className="py-2.5 pr-3 text-v2-text">{r.trigger === "cron" ? t("Jadval") : t("Qo'lda")}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-v2-text">{r.flushed + r.flushFailed}</td>
                  {KINDS.map((k) => {
                    const rep = reportOf(r, k);
                    const bad = rep && (rep.errors.length > 0 || rep.remaining > 0);
                    return (
                      <td key={k} className="py-2.5 text-center">
                        {!rep ? <span className="text-v2-text-3">—</span> : bad ? <CircleAlert className="mx-auto size-4 text-v2-warning" aria-label={t("muammo")} /> : <Check className="mx-auto size-4 text-v2-success" aria-label={t("tayyor")} />}
                      </td>
                    );
                  })}
                  <td className="py-2.5 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-v2-caption font-semibold ${r.ok ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`} title={r.error ?? ""}>
                      {!r.finishedAt ? t("davom etmoqda") : r.ok ? t("Hammasi sinxron") : r.error ? t("Xato") : t("Farqlar qoldi")}
                    </span>
                  </td>
                </tr>
              ))}
              {!d.runs.length && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-v2-text-3">{t("Hali tekshiruv bo'lmagan")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
