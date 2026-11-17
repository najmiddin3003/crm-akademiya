"use client";

import { useRef, useState } from "react";
import { ArrowRight, Info, Loader2, RotateCcw } from "lucide-react";
import Link from "@/components/ui/Link";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { fieldCls } from "@/components/v2/form/fields";
import V2DateRange from "@/components/v2/ui/V2DateRange";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar, PageHead, PageShell, TH } from "@/components/v2/students/lists/listKit";
import { useReportData, useToday } from "@/components/v2/reports/reportHooks";
import { dateOfIso, isoOf } from "@/components/v2/reports/reportFormat";
import { renderAutoHtml, type AutoMessagesPayload, type AutoRow } from "@/lib/autoMessageTypes";

// YANGI VERSIYA — SOTUV VA MARKETING → «AVTOMATIK XABARLAR» (36-qism, rasm «Avtomatik xabarlar»).
// Hodisa bo'lganda o'quvchi va ota-onaga botdan o'zi ketadigan xabarlar: davr statistikasi, hodisalar jadvali
// (qachon, kimga, kanal, yuborildi / yetmadi) va o'ngda tanlangan hodisa — yoqish/o'chirish, matn, o'zgaruvchilar,
// «Ota-ona shunday ko'radi». SMS zaxira hali yo'q (to'lov SMS i markaz qarori bilan to'xtatilgan — lib/paymentSms.ts).
// Server: /api/auto-messages (lib/autoMessages.ts), yuborish — lib/studentBot/notify.ts.

export default function AutoMessagesV2() {
  const { t } = useT();
  const today = useToday();
  const [range, setRange] = useState<DateRange>(() => ({ start: dateOfIso(`${today.slice(0, 7)}-01`), end: dateOfIso(today) }));
  const [sel, setSel] = useState("payment");
  const from = range.start ? isoOf(range.start) : `${today.slice(0, 7)}-01`;
  const to = range.start ? isoOf(range.end ?? range.start) : today;
  const { data: d, error, reload } = useReadyData(`/api/auto-messages?from=${from}&to=${to}`);
  const cur = d?.rows.find((r) => r.key === sel) ?? d?.rows[0];
  const k = d?.kpi;
  const pct = (a: number) => (k && k.total ? Math.round((a / k.total) * 100) : 0);

  return (
    <PageShell flow>
      <PageHead title={t("Avtomatik xabarlar")} subtitle={t("Hodisa bo'lganda o'quvchi yoki ota-onaga o'zi ketadigan xabarlar · Telegram bot orqali")} />
      <div className="flex flex-wrap items-center gap-2">
        <V2DateRange value={range} onChange={setRange} allowAll={false} align="start" />
      </div>
      {error && <NoticeBar>{t("Ma'lumot olinmadi")}</NoticeBar>}
      {d && !d.pushOn && <NoticeBar>{t("Botdan avtomatik xabar yuborish serverda o'chiq (STUDENT_BOT_PUSH_ENABLED) — sozlamalar saqlanadi, lekin xabar ketmaydi.")}</NoticeBar>}
      {!d && !error && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}
      {d && k && cur && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label={t("Yuborildi")} value={k.total} sub={t("davrda · to'lov va davomat xabarlari")} />
            <Kpi label={t("Yetkazildi")} value={k.delivered} badge={k.total ? `${pct(k.delivered)}%` : undefined} tone="success" sub={t("Telegram {a} · SMS {b}", { a: k.telegram, b: k.sms })} />
            <Kpi label={t("Yetmadi")} value={k.failed} badge={k.total ? `${pct(k.failed)}%` : undefined} tone="danger" sub={t("bot ulanmagan yoki bloklagan")} />
            <Kpi label={t("Navbatda")} value={k.pending} sub={t("SMS — operatorga topshirish navbatida")} />
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <h2 className="font-semibold text-v2-text">{t("Hodisalar")}</h2>
                <span className="text-v2-small text-v2-text-2">{t("hodisa bo'lganda ketadi")}</span>
              </div>
              <div className="overflow-x-auto border-t border-v2-border">
                <table className="w-full min-w-[640px] border-collapse text-v2-body">
                  <thead>
                    <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                      <th className={`${TH} pl-4`}>{t("Hodisa")}</th>
                      <th className={TH}>{t("Kimga")}</th>
                      <th className={TH}>{t("Kanal")}</th>
                      <th className={`${TH} pr-4`}>{t("Davrda")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.key} onClick={() => setSel(r.key)} className={`cursor-pointer border-b border-v2-border last:border-b-0 hover:bg-v2-hover ${cur.key === r.key ? "bg-v2-brand-bg" : ""}`}>
                        <td className="py-2.5 pl-4 pr-3">
                          <div className="flex items-center gap-2">
                            <span className={`size-2 shrink-0 rounded-full ${r.enabled ? "bg-v2-success" : "bg-v2-border-strong"}`} aria-hidden />
                            <span className={`font-semibold ${r.enabled ? "text-v2-text" : "text-v2-text-2"}`}>{t(r.name)}</span>
                          </div>
                          <div className="pl-4 text-v2-small text-v2-text-2">{t(r.when)}</div>
                        </td>
                        <td className="px-3 py-2.5 text-v2-text">{t(r.who)}</td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-full bg-v2-info-bg px-2 py-0.5 text-v2-small font-semibold text-v2-info">{r.key === "first_lesson" ? "SMS" : "Telegram"}</span>
                        </td>
                        <td className="py-2.5 pl-3 pr-4">
                          {!r.wired ? (
                            <span className="text-v2-small text-v2-text-3">{t("ulanmagan")}</span>
                          ) : !r.enabled ? (
                            <span className="text-v2-small text-v2-text-3">{t("o'chirilgan")}</span>
                          ) : r.sent === null ? (
                            <span className="text-v2-small text-v2-text-3">{t("jurnal yuritilmaydi")}</span>
                          ) : (
                            <>
                              <div className="font-semibold tabular-nums text-v2-text">{r.sent.toLocaleString("ru-RU")}</div>
                              <div className={`text-v2-small ${r.failed ? "text-v2-danger" : "text-v2-text-3"}`}>{t("{n} yetmadi", { n: r.failed ?? 0 })}</div>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-v2-border bg-v2-surface-2 px-4 py-2.5 text-v2-small">
                <span className="font-semibold text-v2-text">{t("Tizim xabarlari")}</span>
                <span className="text-v2-text-2">{t("parol tiklash {a} va xodim taklifi {b} · faqat SMS · {c} tasi yetmadi", { a: d.system.reset, b: d.system.invite, c: d.system.failed })}</span>
                <Link href="/sales-messages" className="ml-auto inline-flex items-center gap-1 font-semibold text-v2-brand">
                  {t("Xabarlar ro'yhati")} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-v2-border px-4 py-2.5 text-v2-small">
                <span className="text-v2-text-2">{t("Yetmagan {n} ta xabarning sababi — Nazorat bo'limida", { n: k.failed })}</span>
                <Link href="/nazorat-sms-analytics" className="ml-auto inline-flex items-center gap-1 font-semibold text-v2-brand">
                  {t("Xabarlar yetkazilishi")} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </section>
            <Editor key={`${cur.key}:${cur.text}:${cur.enabled}`} r={cur} onSaved={reload} />
          </div>
        </>
      )}
    </PageShell>
  );
}

const useReadyData = (url: string) => useReportData<AutoMessagesPayload>(url);

function Kpi({ label, value, badge, sub, tone }: { label: string; value: number; badge?: string; sub: string; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="text-v2-small text-v2-text-2">{label}</div>
      <div className="mt-1 text-[24px] font-semibold leading-8 tabular-nums text-v2-text">
        {value.toLocaleString("ru-RU")} {badge && <span className={`text-v2-small font-semibold ${tone === "danger" ? "text-v2-danger" : "text-v2-success"}`}>{badge}</span>}
      </div>
      <div className="truncate text-v2-small text-v2-text-2">{sub}</div>
    </div>
  );
}

function Editor({ r, onSaved }: { r: AutoRow; onSaved: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [on, setOn] = useState(r.enabled);
  const [text, setText] = useState(r.text);
  const [tab, setTab] = useState<"tg" | "sms">("tg");
  const [saving, setSaving] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const dirty = on !== r.enabled || text !== r.text;

  function insert(v: string) {
    const el = ta.current;
    const tok = `{${v}}`;
    if (!el) return setText((x) => x + tok);
    const a = el.selectionStart ?? text.length;
    const b = el.selectionEnd ?? a;
    setText(text.slice(0, a) + tok + text.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + tok.length, a + tok.length);
    });
  }
  async function save() {
    setSaving(true);
    const res = await fetch("/api/auto-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: r.key, enabled: on, text }) })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Saqlandi"));
    onSaved();
  }

  return (
    <aside aria-label={t(r.name)} className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div>
          <h2 className="text-[17px] font-semibold text-v2-text">{t(r.name)}</h2>
          <p className="text-v2-small text-v2-text-2">
            {t(r.when)} · {t(r.who)}
          </p>
        </div>
        {r.wired ? (
          <button type="button" role="switch" aria-checked={on} aria-label={t("Yoqilgan")} onClick={() => setOn(!on)} className="flex shrink-0 items-center gap-2 text-v2-small font-semibold">
            <span className={on ? "text-v2-success" : "text-v2-text-2"}>{on ? t("Yoqilgan") : t("O'chirilgan")}</span>
            <span className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-v2-brand" : "bg-v2-border-strong"}`}>
              <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
            </span>
          </button>
        ) : (
          <span className="shrink-0 rounded-full bg-v2-surface-2 px-2 py-0.5 text-v2-small font-semibold text-v2-text-2">{t("Ulanmagan")}</span>
        )}
      </div>
      <div className="px-4">
        <div role="tablist" className="flex gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
          {(
            [
              ["tg", t("Telegram bot")],
              ["sms", t("SMS zaxira · o'chiq")],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`h-8 flex-1 rounded-v2-sm text-v2-small font-semibold ${tab === key ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === "sms" ? (
        <div className="space-y-2 p-4 text-v2-small text-v2-text-2">
          <p className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("Botga ulanmaganlarga SMS bilan yuborish hali yo'q. To'lov SMS i markaz qarori bilan to'xtatilgan (10.09.2026); SMS matni Eskiz'da oldindan tasdiqlanishi shart.")}
          </p>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {!r.wired && <NoticeBar>{t("Bu hodisaning yuboruvchisi hali yozilmagan — matnni ko'rib chiqish mumkin, saqlab bo'lmaydi.")}</NoticeBar>}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="auto-text" className="text-v2-small font-semibold text-v2-text">
                {t("Matn")}
              </label>
              {r.wired && text !== r.def && (
                <button type="button" onClick={() => setText(r.def)} className="inline-flex items-center gap-1 text-v2-small text-v2-brand">
                  <RotateCcw className="size-3.5" aria-hidden /> {t("Standart matn")}
                </button>
              )}
            </div>
            <textarea id="auto-text" ref={ta} value={text} onChange={(e) => setText(e.target.value)} rows={9} maxLength={1500} disabled={!r.wired} className={fieldCls("default", "h-auto py-2 font-mono text-[13px] leading-5")} />
          </div>
          <div>
            <div className="mb-1.5 text-v2-small text-v2-text-2">{t("O'zgaruvchi qo'shish — bosing")}</div>
            <div className="flex flex-wrap gap-1.5">
              {r.vars.map((v) => (
                <button key={v} type="button" disabled={!r.wired} onClick={() => insert(v)} className="rounded-v2-sm border border-v2-border bg-v2-surface px-2 py-0.5 font-mono text-[12px] text-v2-text hover:bg-v2-hover disabled:opacity-50">{`{${v}}`}</button>
              ))}
            </div>
            <p className="mt-1.5 text-v2-caption text-v2-text-3">{t("*qalin*, _qiya_ · qiymati bo'sh o'zgaruvchili qator tushib qoladi")}</p>
          </div>
          <div>
            <div className="mb-1.5 text-v2-small font-semibold text-v2-text">{t("Ota-ona shunday ko'radi")}</div>
            <div className="rounded-v2-md bg-v2-surface-2 p-3">
              <div className="max-w-[300px] rounded-v2-md bg-v2-surface p-3 text-v2-small leading-5 text-v2-text shadow-v2-sm">
                <div className="whitespace-pre-line [&_b]:font-semibold" dangerouslySetInnerHTML={{ __html: renderAutoHtml(text, r.sample) }} />
                <div className="mt-1 text-right text-v2-caption text-v2-text-3">{t("Tizimli bot")}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {r.wired && (
        <div className="flex items-center justify-end gap-2 border-t border-v2-border p-4">
          {dirty && (
            <button type="button" onClick={() => (setOn(r.enabled), setText(r.text))} className={secondaryBtn}>
              {t("Bekor qilish")}
            </button>
          )}
          <button type="button" onClick={() => void save()} disabled={!dirty || saving} className={`${primaryBtn} disabled:opacity-50`}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />} {t("Saqlash")}
          </button>
        </div>
      )}
    </aside>
  );
}
