"use client";

import { useState } from "react";
import { CalendarCheck, CircleCheck, Clock, Eye, Loader2, Phone } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { Card, CardTitle } from "@/components/v2/teacher/teacherBits";
import { RESULT_LABEL, nextLabel } from "./CallQueueV2";

// YANGI VERSIYA — MODERATOR · NATIJALARIM (46-qism, rasmlar «Moderator · natijalarim» kompyuter / telefon). Davr
// (Bugun / Hafta / Oy): 4 ko'rsatkich, kunlar bo'yicha qo'ng'iroqlar (bugun — `brand`), qo'ng'iroq turlari, liddan
// o'quvchigacha (siz yozgan birinchi darslar → keldi → to'ladi), qoidalar bajarilishi, oxirgi qo'ng'iroqlar jadvali.
// Manba — `lead_calls` (navbat paneli yozadi; /api/front?view=stats).

interface Stats {
  ok: true;
  today: string;
  period: "bugun" | "hafta" | "oy";
  from: string;
  who: { name: string; preview: boolean };
  branch: string;
  kpi: { calls: number; answered: number; answeredPct: number | null; fresh: number; within24: number; booked: number; came: number; paid: number };
  days: { date: string; n: number }[];
  kinds: { kind: string; n: number }[];
  rules: { name: string; done: number; total: number }[];
  recent: { id: number; time: string; date: string; name: string; type: string; kind: string; subject: string; result: string; next: string; nextText: string; note: string }[];
}
const KIND_LABEL: Record<string, string> = { yangi: "Yangi lid", davomat: "Davomat · darsga kelmadi", eslatma: "Eslatma", qayta: "Qayta qo'ng'iroq", birinchi_keyin: "Birinchi darsdan keyin" };

export default function MyCallsV2({ as }: { as?: string }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [period, setPeriod] = useState<"bugun" | "hafta" | "oy">("oy");
  const { data: d, error } = useReportData<Stats>(`/api/front?view=stats&period=${period}${as ? `&as=${encodeURIComponent(as)}` : ""}`);
  if (error)
    return (
      <div data-ui="v2" className="p-4">
        <NoticeBar>{t("Ma'lumot yuklanmadi")}</NoticeBar>
      </div>
    );
  if (!d)
    return (
      <div data-ui="v2" className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const max = Math.max(1, ...d.days.map((x) => x.n));
  const kmax = Math.max(1, ...d.kinds.map((x) => x.n));
  const range = d.period === "bugun" ? fmt.dayMonth(d.today) : `${fmt.dayMonth(d.from)} – ${fmt.dayMonth(d.today)}`;
  const funnel = [
    [t("Siz yozgan birinchi darslar"), d.kpi.booked],
    [t("Birinchi darsga keldi"), d.kpi.came],
    [t("To'ladi — o'quvchi bo'ldi"), d.kpi.paid],
  ] as const;
  const fmax = Math.max(1, d.kpi.booked);

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-bg p-4 font-v2 text-v2-text sm:p-6">
      {d.who.preview ? <NoticeBar icon={Eye}>{t("Rahbar ko'rinishi: {name}", { name: d.who.name })}</NoticeBar> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Natijalarim")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{[d.who.name, t("Moderator"), d.branch].filter(Boolean).join(" · ")}</p>
        </div>
        <div role="tablist" className="inline-flex rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
          {(
            [
              ["bugun", t("Bugun")],
              ["hafta", t("Hafta")],
              ["oy", fmt.monthName(d.today.slice(0, 7))],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={period === k} onClick={() => setPeriod(k)} className={`h-8 rounded-v2-sm px-3 text-v2-small ${period === k ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border xl:grid-cols-4">
        <Kpi icon={<Phone className="size-5" strokeWidth={1.75} />} tone="bg-v2-brand-bg text-v2-brand-text" value={String(d.kpi.calls)} label={t("Qo'ng'iroq · {r}", { r: range })} />
        <Kpi icon={<CircleCheck className="size-5" strokeWidth={1.75} />} tone="bg-v2-success-bg text-v2-success" value={d.kpi.answeredPct !== null ? `${d.kpi.answeredPct}%` : "—"} label={t("Javob berdi · {n} ta", { n: d.kpi.answered })} />
        <Kpi icon={<Clock className="size-5" strokeWidth={1.75} />} tone="bg-v2-info-bg text-v2-info" value={d.kpi.fresh ? `${Math.round((d.kpi.within24 / d.kpi.fresh) * 100)}%` : "—"} label={t("Lidga 24 soat ichida · {a} / {b}", { a: d.kpi.within24, b: d.kpi.fresh })} />
        <Kpi icon={<CalendarCheck className="size-5" strokeWidth={1.75} />} tone="bg-v2-violet-bg text-v2-violet" value={String(d.kpi.booked)} label={t("Birinchi darsga yozdingiz · {n} tasi keldi", { n: d.kpi.came })} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardTitle title={t("Kunlar bo'yicha qo'ng'iroqlar")} sub={t("{r} · bugun {n} ta", { r: range, n: d.days[d.days.length - 1]?.n ?? 0 })} />
            <div className="flex h-44 items-end gap-1.5 border-b border-v2-border">
              {d.days.map((x) => (
                <div key={x.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${fmt.dayMonth(x.date)}: ${x.n}`}>
                  {x.n === max || x.date === d.today ? <span className="text-v2-caption font-semibold tabular-nums text-v2-text">{x.n}</span> : null}
                  <span className={`w-full max-w-[2.5rem] rounded-t-v2-sm ${x.date === d.today ? "bg-v2-brand" : "bg-v2-info"}`} style={{ height: `${x.n ? Math.max(4, (x.n / max) * 130) : 2}px` }} />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {d.days.map((x) => (
                <span key={x.date} className="flex-1 text-center text-[0.6875rem] tabular-nums text-v2-text-3">
                  {Number(x.date.slice(8, 10))}
                </span>
              ))}
            </div>
          </Card>
          <Card>
            <CardTitle title={t("Qo'ng'iroq turlari")} sub={t("{n} ta · nima uchun qo'ng'iroq qilingan", { n: d.kpi.calls })} />
            {d.kinds.length === 0 ? (
              <p className="text-v2-small text-v2-text-3">{t("Bu davrda qo'ng'iroq yo'q.")}</p>
            ) : (
              <ul className="space-y-2.5">
                {d.kinds.map((k) => (
                  <li key={k.kind} className="grid grid-cols-[11rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-v2-small">
                    <span className="text-v2-text-2">{t(KIND_LABEL[k.kind] ?? k.kind)}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-v2-track">
                      <span className="block h-full rounded-full bg-v2-info" style={{ width: `${(k.n / kmax) * 100}%` }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums text-v2-text">{k.n}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardTitle title={t("Liddan o'quvchigacha")} sub={t("siz qo'ng'iroq qilgan lidlar · {r}", { r: range })} />
            <ul className="space-y-3">
              {funnel.map(([label, n], i) => (
                <li key={label}>
                  <div className="flex justify-between text-v2-small">
                    <span className={i === 0 ? "font-semibold text-v2-text" : "text-v2-text-2"}>{label}</span>
                    <b className="tabular-nums">{n}</b>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-v2-track">
                    <div className="h-full rounded-full bg-v2-info" style={{ width: `${(n / fmax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-v2-caption text-v2-text-3">{t("Darsdan keyingi qo'ng'iroq o'sha kuni bo'lsa, to'lov ehtimoli oshadi.")}</p>
          </Card>
          <Card>
            <CardTitle title={t("Qoidalar")} sub={t("Nazorat qoidalari bo'yicha")} />
            <ul className="divide-y divide-v2-border">
              {d.rules.map((r) => {
                const pct = r.total ? Math.round((r.done / r.total) * 100) : null;
                return (
                  <li key={r.name} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <div className="text-v2-small font-semibold text-v2-text">{t(r.name)}</div>
                      <div className="text-v2-caption text-v2-text-3">
                        {r.done} / {r.total}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-v2-sm px-2 py-0.5 text-v2-caption font-semibold ${pct === null ? "bg-v2-surface-2 text-v2-text-3" : pct >= 90 ? "bg-v2-success-bg text-v2-success" : pct >= 70 ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-danger-bg text-v2-danger"}`}>{pct === null ? "—" : `${pct}%`}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="!p-0 sm:!p-0">
        <div className="p-4 sm:p-5">
          <CardTitle title={t("Oxirgi qo'ng'iroqlar")} sub={t("{n} ta", { n: d.recent.length })} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-v2-small">
            <thead>
              <tr className="border-y border-v2-border bg-v2-surface-2 text-v2-caption text-v2-text-3">
                <th className="px-5 py-2 font-medium">{t("Vaqt")}</th>
                <th className="px-3 py-2 font-medium">{t("Kimga")}</th>
                <th className="px-3 py-2 font-medium">{t("Turi")}</th>
                <th className="px-3 py-2 font-medium">{t("Natija")}</th>
                <th className="px-3 py-2 font-medium">{t("Keyingi qadam")}</th>
              </tr>
            </thead>
            <tbody>
              {d.recent.map((r) => (
                <tr key={r.id} className="border-b border-v2-border">
                  <td className="px-5 py-2.5 font-semibold tabular-nums">
                    {r.date !== d.today ? <span className="mr-1 font-normal text-v2-text-3">{fmt.dayMonth(r.date)}</span> : null}
                    {r.time}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-v2-text">{r.name}</td>
                  <td className="px-3 py-2.5 text-v2-text-2">{[r.type === "pupil" ? t("O'quvchi") : t("Lid"), r.subject].filter(Boolean).join(" · ")}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-v2-sm px-2 py-0.5 text-v2-caption ${r.result === "javob" ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"}`}>{t(RESULT_LABEL[r.result] ?? r.result)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-v2-text-2">{[r.nextText || nextLabel(t, r.next), r.note].filter(Boolean).join(" — ") || "—"}</td>
                </tr>
              ))}
              {d.recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-v2-text-3">
                    {t("Bu davrda qo'ng'iroq yo'q.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 bg-v2-surface px-3 py-3 sm:px-4 sm:py-4">
      <span className={`hidden size-10 shrink-0 place-items-center rounded-v2-md sm:grid ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[1.375rem] font-semibold leading-7 tabular-nums text-v2-text">{value}</div>
        <div className="text-v2-caption text-v2-text-2">{label}</div>
      </div>
    </div>
  );
}
