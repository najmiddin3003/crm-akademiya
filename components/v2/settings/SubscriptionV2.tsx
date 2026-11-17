"use client";

import { useState } from "react";
import { Info, Loader2, Monitor, RefreshCw, Smartphone, Trophy } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, TH } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import type { SubscriptionPayload } from "@/lib/subscription";

// YANGI VERSIYA — SOZLAMALAR → «OBUNA VA TO'LOV» (37-qism, rasmlar «Obuna», «Obuna — to'lash»). Joriy muddat va
// qolgan kunlar (chiziq), markaz ko'rsatkichlari, tariflar, to'lovlar tarixi, modullar; «Muddatni uzaytirish» —
// davr tanlash va Tizimli'ga so'rov (hisob-faktura). Server: /api/subscription (lib/subscription.ts) — faqat direktor.

const som = (n: number) => n.toLocaleString("ru-RU");
const addMonths = (iso: string, m: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString().slice(0, 10);
};
/** `dayMonth` boshqa yil sanasiga yilni o'zi qo'shadi — takrorlanmasin. */
const withYear = (s: string, iso: string) => (s.includes(iso.slice(0, 4)) ? s : `${s} ${iso.slice(0, 4)}`);
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export default function SubscriptionV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { data: d, error, reload } = useReportData<SubscriptionPayload>("/api/subscription");
  const [open, setOpen] = useState(false);
  const full = (iso: string) => withYear(fmt.dayMonth(iso), iso);
  const s = d?.sub;
  const total = s ? Math.max(1, days(s.from, s.until)) : 1;
  const passed = s ? Math.min(total, Math.max(0, days(s.from, d!.today))) : 0;
  const left = s ? days(d!.today, s.until) : 0;

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div>
        <div className="text-v2-small text-v2-text-2">Tizimli</div>
        <h1 className="text-v2-page text-v2-text">{t("Obuna va to'lov")}</h1>
        <p className="text-v2-small text-v2-text-2">{t("Tizimli xizmatidan foydalanish muddati, to'lovlar va hujjatlar · faqat direktor ko'radi")}</p>
      </div>
      {error && <NoticeBar>{t("Ma'lumot olinmadi")}</NoticeBar>}
      {!d && !error && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}
      {d && (
        <>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {s ? (
                  <>
                    <div className="flex items-center gap-2 text-v2-small text-v2-text-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-v2-caption font-semibold ${left >= 0 ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"}`}>
                        <span className="size-1.5 rounded-full bg-current" /> {left >= 0 ? t("Faol") : t("Muddati o'tgan")}
                      </span>
                      {t("{n} oylik tarif · {d} dan", { n: s.months, d: fmt.dayMonth(s.from) })}
                    </div>
                    <div className="mt-1 text-[26px] font-semibold text-v2-text">{t("{d} gacha", { d: full(s.until) })}</div>
                    <div className="text-v2-body text-v2-text-2">
                      <b className="text-v2-text">{t("{n} kun", { n: Math.max(0, left) })}</b> {t("qoldi · keyingi to'lov — {p} so'm", { p: som(s.nextPrice) })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[20px] font-semibold text-v2-text">{t("Obuna ma'lumoti hali kiritilmagan")}</div>
                    <p className="text-v2-small text-v2-text-2">{t("Muddat va to'lovlarni Tizimli jamoasi kiritadi. Savol bo'lsa — Texnik yordam.")}</p>
                  </>
                )}
              </div>
              <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
                <RefreshCw className="size-4" aria-hidden /> {t("Muddatni uzaytirish")}
              </button>
            </div>
            {s && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-v2-surface-2">
                  <div className="h-full rounded-full bg-v2-brand" style={{ width: `${(passed / total) * 100}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-v2-caption text-v2-text-2">
                  <span>{fmt.dayMonth(s.from)}</span>
                  <span>{t("bugun · {a} / {b} kun", { a: passed, b: total })}</span>
                  <span>{fmt.dayMonth(s.until)}</span>
                </div>
              </div>
            )}
            {d.pending && <NoticeBar>{t("Uzaytirish so'rovi yuborilgan: {n} oy, {p} so'm — Tizimli hisob-faktura yuboradi", { n: d.pending.months, p: som(d.pending.amount) })}</NoticeBar>}
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                [t("Faol o'quvchilar"), som(d.counts.pupils)],
                [t("Filiallar"), String(d.counts.branches)],
                [t("Login hisoblari"), String(d.counts.logins)],
                [t("Hisob ochilgan"), d.counts.since ? full(d.counts.since) : "—"],
              ].map(([a, b]) => (
                <div key={a} className="rounded-v2-md border border-v2-border bg-v2-surface-2 p-3">
                  <div className="text-v2-small text-v2-text-2">{a}</div>
                  <div className="text-[20px] font-semibold tabular-nums text-v2-text">{b}</div>
                </div>
              ))}
            </div>
          </section>
          <p className="flex items-start gap-2 text-v2-small text-v2-text-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Muddat tugasa ham ma'lumotlar o'chmaydi. To'lov qilingach hammasi joyida.")}
          </p>

          <div>
            <h2 className="mb-2 font-semibold text-v2-text">
              {t("Tariflar")} <span className="font-normal text-v2-small text-v2-text-2">· {t("barcha modullar va filiallar kiradi")}</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {d.tariffs.map((x) => {
                const cur = s?.months === x.months;
                return (
                  <div key={x.months} className={`rounded-v2-lg border p-4 ${cur ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border bg-v2-surface"}`}>
                    <div className="flex items-center justify-between text-v2-body font-semibold text-v2-text">
                      {t("{n} oy", { n: x.months })}
                      {cur ? <span className="text-v2-caption text-v2-brand">{t("Joriy")}</span> : x.bonus ? <span className="rounded-full bg-v2-success-bg px-2 text-v2-caption text-v2-success">+{t("{n} oy", { n: x.bonus })}</span> : null}
                    </div>
                    <div className="mt-1 text-[20px] font-semibold tabular-nums text-v2-text">
                      {som(x.price)} <span className="text-v2-small font-normal text-v2-text-2">so&apos;m</span>
                    </div>
                    <div className="text-v2-small text-v2-text-2">{x.bonus ? t("{a} oy · oyiga ≈ {p}", { a: x.months + x.bonus, p: som(Math.round(x.price / (x.months + x.bonus))) }) : t("oyiga {p}", { p: som(x.price / x.months) })}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="px-4 py-3">
                <h2 className="font-semibold text-v2-text">{t("To'lovlar tarixi")}</h2>
                <p className="text-v2-small text-v2-text-2">{t("Tizimli xizmati uchun to'lovlar")}</p>
              </div>
              <div className="overflow-x-auto border-t border-v2-border">
                <table className="w-full min-w-[520px] border-collapse text-v2-body">
                  <thead>
                    <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                      <th className={`${TH} pl-4`}>{t("Sana")}</th>
                      <th className={TH}>{t("Davr")}</th>
                      <th className={`${TH} text-right`}>{t("Summa, so'm")}</th>
                      <th className={`${TH} pr-4`}>{t("Usul")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.payments.map((p, i) => (
                      <tr key={i} className="border-b border-v2-border last:border-b-0">
                        <td className="py-2.5 pl-4 pr-3 tabular-nums text-v2-text">{full(p.date)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-v2-text-2">
                          {p.from.slice(8, 10)}.{p.from.slice(5, 7)} – {p.to.slice(8, 10)}.{p.to.slice(5, 7)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">{som(p.amount)}</td>
                        <td className="py-2.5 pl-3 pr-4 text-v2-text-2">{t(p.method)}</td>
                      </tr>
                    ))}
                    {!d.payments.length && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-v2-small text-v2-text-3">
                          {t("To'lov yozuvi yo'q")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
              <h2 className="font-semibold text-v2-text">{t("Modullar")}</h2>
              <p className="mb-2 text-v2-small text-v2-text-2">{t("Hammasi obuna ichida — alohida to'lov yo'q")}</p>
              <ul className="divide-y divide-v2-border">
                {[
                  [Trophy, t("Gamifikatsiya"), d.modules.gamification ? t("Yoqilgan") : t("O'chiq"), d.modules.gamification ? "success" : "neutral"],
                  [Monitor, t("Onlayn kurslar"), t("{n} ta kurs", { n: d.modules.onlineCourses }), d.modules.onlineCourses ? "success" : "neutral"],
                  [Smartphone, t("Mobil ilova"), t("Tez orada"), "info"],
                ].map(([I, a, b, tone]) => {
                  const Icon = I as typeof Trophy;
                  return (
                    <li key={String(a)} className="flex items-center gap-3 py-2.5">
                      <span className="flex size-9 items-center justify-center rounded-v2-md bg-v2-surface-2 text-v2-text-2">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="flex-1 font-semibold text-v2-text">{String(a)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-v2-caption font-semibold ${tone === "success" ? "bg-v2-success-bg text-v2-success" : tone === "info" ? "bg-v2-info-bg text-v2-info" : "bg-v2-surface-2 text-v2-text-2"}`}>{String(b)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </>
      )}
      {open && d && <ExtendDialog d={d} onClose={() => setOpen(false)} onDone={reload} />}
    </div>
  );
}

function ExtendDialog({ d, onClose, onDone }: { d: SubscriptionPayload; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [m, setM] = useState(d.sub?.months ?? 3);
  const [busy, setBusy] = useState(false);
  const tf = d.tariffs.find((x) => x.months === m)!;
  const start = d.sub && d.sub.until > d.today ? d.sub.until : d.today;
  const end = addMonths(start, tf.months + tf.bonus);
  async function send(close: () => void) {
    setBusy(true);
    const r = await fetch("/api/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ months: m }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Yuborib bo'lmadi"));
    showSuccess(t("So'rov yuborildi — hisob-faktura keladi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("Muddatni uzaytirish")}
      subtitle={d.sub ? t("Hozirgi muddat {d} da tugaydi — yangi davr shundan keyin boshlanadi", { d: fmt.dayMonth(d.sub.until) }) : t("Yangi davr bugundan boshlanadi")}
      onClose={onClose}
      saving={busy}
      width={600}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void send(api.close)} disabled={busy} className={primaryBtn}>
            {t("Hisob-faktura so'rash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <div className="mb-2 text-v2-small font-semibold text-v2-text">{t("Davr")}</div>
          <div role="radiogroup" aria-label={t("Davr")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {d.tariffs.map((x) => (
              <button key={x.months} type="button" role="radio" aria-checked={m === x.months} onClick={() => setM(x.months)} className={`rounded-v2-md border p-3 text-left ${m === x.months ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border"}`}>
                <div className="flex justify-between text-v2-small font-semibold text-v2-text">
                  {t("{n} oy", { n: x.months })} {x.bonus ? <span className="text-v2-success">+{x.bonus}</span> : null}
                </div>
                <div className="font-semibold tabular-nums text-v2-text">{som(x.price)}</div>
                <div className="text-v2-caption text-v2-text-2">so&apos;m</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-v2-small text-v2-text-2">
            {t("Yangi muddat")}: <b className="text-v2-text">{`${withYear(fmt.dayMonth(start), start)} → ${withYear(fmt.dayMonth(end), end)}`}</b> · {t("{n} oy", { n: tf.months + tf.bonus })}
          </p>
        </div>
        <div className="rounded-v2-md border border-v2-brand bg-v2-brand-bg p-3">
          <div className="font-semibold text-v2-text">{t("Hisob raqam orqali")}</div>
          <div className="text-v2-small text-v2-text-2">{t("Tizimli hisob-faktura yuboradi · pul tushgach obuna uzayadi")}</div>
        </div>
        <div className="rounded-v2-md border border-v2-border p-3 opacity-60">
          <div className="font-semibold text-v2-text">
            Click / Payme <span className="ml-1 rounded-v2-sm bg-v2-info-bg px-1.5 text-v2-caption text-v2-info">{t("Tez orada")}</span>
          </div>
          <div className="text-v2-small text-v2-text-2">{t("Karta bilan darhol to'lash hali ulanmagan")}</div>
        </div>
        <div className="flex items-center justify-between rounded-v2-md bg-v2-surface-2 px-4 py-3">
          <span className="text-v2-text-2">{t("Jami to'lov")}</span>
          <span className="text-[22px] font-semibold tabular-nums text-v2-text">
            {som(tf.price)} <span className="text-v2-small font-normal text-v2-text-2">so&apos;m</span>
          </span>
        </div>
      </div>
    </V2Dialog>
  );
}
