"use client";

import { useState } from "react";
import { Check, CheckCircle2, ChevronRight, Clock, Eye, ImageIcon, KeyRound, Loader2, Lock, MessageSquare, QrCode, RefreshCw, Smartphone, Wallet, Wrench } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { Card, CardTitle, fmtSum } from "@/components/v2/teacher/teacherBits";
import { deskQs, shortWhen, taskAction } from "./deskBits";

// YANGI VERSIYA — IT MUTAXASSISI VA XIZMAT XODIMI · BOSH SAHIFA (47-qism, rasmlar telefonda «IT mutaxassisi · bosh sahifa»,
// «Xizmat xodimi · bosh sahifa»; kompyuterda o'sha kartalar ikki ustunda). «Keldingiz» kartasi, «Topshiriqlarim» —
// «Bajardim» (mavjud /api/staff-tasks/:id), IT — «Tizim holati» (sinxron, SMS qurilmalar, QR/turniket, xodim ilovasi,
// loginlar — faqat ko'rish), xizmat xodimi — «Bu hafta · ish vaqti»; «Qolgan oylik» (oklad × o'tgan ish kunlari − avans).
// Server — /api/staff-desk?view=worker (lib/staffDesk.ts).

interface Data {
  ok: true;
  today: string;
  now: string;
  who: { name: string; mode: "it" | "service" | "manager"; preview: boolean };
  branch: string;
  keldim: { time: string; exit: string; late: boolean; source: string } | null;
  schedule: { name: string; start: string; end: string } | null;
  tasks: { id: number; title: string; desc: string; deadline: string; leftMin: number | null; priority: number; status: string; by: string }[];
  week: { date: string; work: boolean; start: string; end: string }[];
  salary: { month: string; oklad: number; planned: number; passed: number; earned: number; taken: number; left: number } | null;
  system: { key: string; title: string; sub: string; ok: boolean; badge: string }[] | null;
}
const SYS_ICON = { sync: RefreshCw, sms: MessageSquare, qr: QrCode, app: Smartphone, login: KeyRound } as const;

export default function WorkerHomeV2({ as, mode }: { as?: string; mode?: "it" | "service" }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showError, showSuccess } = useToast();
  const { data: d, error, reload } = useReportData<Data>(`/api/staff-desk?view=worker${deskQs(as, mode)}`);
  const [busy, setBusy] = useState<number | null>(null);
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
  const it = d.who.mode === "it";
  const done = async (id: number) => {
    setBusy(id);
    const r = await taskAction(id, { action: "done" });
    setBusy(null);
    if (!r.ok) return showError(r.error ?? t("Saqlanmadi"));
    showSuccess(t("Bajarildi — rahbar tasdiqlaydi"));
    reload();
  };
  const left = (m: number | null) => {
    if (m === null || m <= 0 || m > 360) return null;
    return m >= 60 ? t("{h} soat {m} daqiqa qoldi", { h: Math.floor(m / 60), m: m % 60 }) : t("{m} daqiqa qoldi", { m });
  };

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-bg p-4 font-v2 text-v2-text sm:p-6">
      {d.who.preview ? <NoticeBar icon={Eye}>{t("Rahbar ko'rinishi: {name}", { name: d.who.name })}</NoticeBar> : null}
      <div>
        <h1 className="text-v2-page text-v2-text">{t("Bosh sahifa")}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">{[d.branch, it ? t("IT mutaxassisi") : t("Xizmat xodimi"), `${t("Bugun")}, ${fmt.dayMonth(d.today)} · ${d.now}`].filter(Boolean).join(" · ")}</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Link href="/xodim/keldim" className={`flex items-center gap-3 rounded-v2-lg border p-4 ${d.keldim ? "border-v2-success bg-v2-success-bg" : "border-v2-warning bg-v2-warning-bg"}`}>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-v2-surface">
              {d.keldim ? <CheckCircle2 className="size-6 text-v2-success" strokeWidth={1.75} aria-hidden /> : <Clock className="size-6 text-v2-warning" strokeWidth={1.75} aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-v2-section text-v2-text">{d.keldim ? t("Keldingiz · {time}", { time: d.keldim.time }) : t("«Keldim» bosilmagan")}</span>
              <span className="block text-v2-small text-v2-text-2">
                {[d.branch, d.keldim?.source === "qr" ? "QR" : d.keldim ? t("Face ID") : null, d.schedule ? t("ish {a}–{b}", { a: d.schedule.start, b: d.schedule.end }) : null, d.keldim && !d.keldim.exit ? t("ketishda «Ketdim»") : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          </Link>

          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle
                title={it ? t("Topshiriqlarim · {n}", { n: d.tasks.length }) : t("Bugungi ishlarim · {n}", { n: d.tasks.length })}
                sub={it ? t("eng shoshilinchi tepada") : t("topshiriqlar · muddati yaqini tepada")}
                right={
                  <Link href="/tasks" className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                    {t("Hammasi")}
                    <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </Link>
                }
              />
            </div>
            {d.tasks.length === 0 ? <p className="border-t border-v2-border px-5 py-5 text-center text-v2-small text-v2-success">{t("Ochiq topshiriq yo'q.")}</p> : null}
            {d.tasks.map((x) => {
              const l = left(x.leftMin);
              const waiting = x.status === "tasdiq_kutilmoqda";
              return (
                <div key={x.id} className="border-t border-v2-border px-4 py-3 sm:px-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-v2-md bg-v2-warning-bg text-v2-warning">
                      <Wrench className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-v2-body font-semibold text-v2-text">{x.title}</div>
                      <div className="text-v2-caption text-v2-text-3">{[x.by, x.deadline ? t("{d} gacha", { d: shortWhen(x.deadline, d.today) }) : null, x.priority ? t("muhimlik {n}", { n: x.priority }) : null].filter(Boolean).join(" · ")}</div>
                      {x.desc ? <div className="mt-0.5 text-v2-caption text-v2-text-2">{x.desc}</div> : null}
                      {l ? (
                        <div className="mt-1 inline-flex items-center gap-1 text-v2-caption font-medium text-v2-warning">
                          <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
                          {l}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {waiting ? (
                    <div className="mt-2 rounded-v2-md bg-v2-info-bg px-3 py-2 text-center text-v2-small text-v2-info">{t("Bajardingiz — rahbar tasdiqlashini kutmoqda")}</div>
                  ) : (
                    <button type="button" disabled={busy !== null} onClick={() => void done(x.id)} className={`${secondaryBtn} mt-2 h-11 w-full justify-center`}>
                      {busy === x.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
                      {t("Bajardim")}
                    </button>
                  )}
                </div>
              );
            })}
            {!it ? (
              <p className="flex items-start gap-2 border-t border-v2-border px-5 py-3 text-v2-caption text-v2-text-3">
                <ImageIcon className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                {t("«Bajardim»dan keyin rasm qo'shsangiz, rahbar tezroq tasdiqlaydi (Topshiriqlar sahifasida).")}
              </p>
            ) : null}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {it && d.system ? (
            <Card className="!p-0 sm:!p-0">
              <div className="p-4 sm:p-5">
                <CardTitle title={t("Tizim holati · hamma filial")} sub={t("Sozlamalar va Boshqaruvdan · faqat ko'rish")} />
              </div>
              {d.system.map((s) => {
                const Icon = SYS_ICON[s.key as keyof typeof SYS_ICON] ?? RefreshCw;
                return (
                  <div key={s.key} className="flex items-center gap-3 border-t border-v2-border px-4 py-3 sm:px-5">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-v2-md ${s.ok ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"}`}>
                      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-v2-body font-semibold text-v2-text">{t(s.title)}</div>
                      <div className="text-v2-caption text-v2-text-3">{s.sub}</div>
                    </div>
                    <span className={`shrink-0 rounded-v2-sm px-2 py-0.5 text-v2-caption ${s.ok ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}>{t(s.badge)}</span>
                  </div>
                );
              })}
              <p className="m-4 flex items-start gap-2 rounded-v2-md border border-dashed border-v2-border-strong px-3 py-2.5 text-v2-caption text-v2-text-2 sm:m-5">
                <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                {t("Sozlamani o'zgartirish va parolni qayta yuborish — rahbarda. Siz qurilmani tuzatasiz va xodimga yordam berasiz.")}
              </p>
            </Card>
          ) : (
            <Card>
              <CardTitle title={t("Bu hafta · ish vaqti")} sub={d.schedule ? `${d.schedule.name} · ${d.schedule.start}–${d.schedule.end}` : t("ish jadvali biriktirilmagan")} />
              <div className="grid grid-cols-7 gap-1.5">
                {d.week.map((w) => {
                  const today = w.date === d.today;
                  return (
                    <div key={w.date} className={`flex flex-col items-center rounded-v2-md px-1 py-2 text-center ${today ? "bg-v2-brand text-v2-on-brand" : w.work ? "bg-v2-surface-2" : ""}`}>
                      <span className={`text-v2-caption ${today ? "" : "text-v2-text-3"}`}>{fmt.weekday(w.date).slice(0, 3)}</span>
                      <span className="text-v2-body font-semibold tabular-nums">{Number(w.date.slice(8, 10))}</span>
                      <span className={`text-[0.625rem] tabular-nums ${today ? "" : "text-v2-text-3"}`}>{w.work && w.start ? `${w.start.slice(0, 2)}–${w.end.slice(0, 2)}` : t("dam")}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {d.salary ? (
            <div className="flex items-center gap-3 rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
              <span className="grid size-10 shrink-0 place-items-center rounded-v2-md bg-v2-surface-2 text-v2-text-2">
                <Wallet className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-v2-caption text-v2-text-3">{t("Qolgan oylik · {m}", { m: fmt.monthLower(d.salary.month) })}</span>
                <span className="block text-v2-section font-semibold tabular-nums text-v2-text">
                  {fmtSum(d.salary.left)} {t("so'm")}
                </span>
                <span className="block text-v2-caption text-v2-text-2">{t("Oklad {o} · {p} kunga {e} · avans {a}", { o: fmtSum(d.salary.oklad), p: d.salary.passed, e: fmtSum(d.salary.earned), a: fmtSum(d.salary.taken) })}</span>
              </span>
            </div>
          ) : null}
          <p className="flex items-start gap-2 rounded-v2-md border border-dashed border-v2-border-strong px-3 py-2.5 text-v2-caption text-v2-text-2">
            <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {t("Sizga faqat o'z topshiriqlaringiz, ish vaqtingiz va oyligingiz ko'rinadi.")}
          </p>
        </div>
      </div>
    </div>
  );
}
