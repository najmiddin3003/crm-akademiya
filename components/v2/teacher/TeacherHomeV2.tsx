"use client";

import { ArrowRight, CalendarDays, Check, ChevronRight, CircleCheck, ClipboardList, Eye, FileText, Loader2, Lock, Wallet, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { Card, CardTitle, FanPill, StepBox, fmtSum, teacherLink, teacherQs, type StepState } from "./teacherBits";

// YANGI VERSIYA — O'QITUVCHI · BOSH SAHIFA (45-qism, rasmlar «O'qituvchi · bosh sahifa» kompyuter / telefon,
// «Keldim bosilmagan»). Tepada 4 ko'rsatkich (Keldim, bugungi dars, tekshirilmagan ish, qolgan oylik), «Bugungi darslar»
// — har dars qadamlari: davomat → mavzu → uy vazifasi → tanga («Darsni ochish»), «Tekshirilmagan uy vazifalari»,
// o'ngda Oyligim, Birinchi darsga keladiganlar, Topshiriqlarim; pastda «Rolingiz» (ko'rasiz / ko'rinmaydi).
// Server — /api/teacher?view=home (lib/teacherDesk.ts).

interface Lesson {
  groupId: number;
  title: string;
  course: string;
  room: string;
  start: string;
  end: string;
  pupils: number;
  state: "hozir" | "keyin" | "tugadi";
  minutesFromStart: number | null;
  closed: boolean;
  attendance: { marked: number; came: number };
  topic: string | null;
  homework: string | null;
  prevPending: number;
  activity: number;
  activityLimit: number;
}
interface Home {
  ok: true;
  today: string;
  now: string;
  who: { name: string; employeeId: number | null; preview: boolean };
  branch: string;
  keldim: { time: string; late: boolean; source: string } | null;
  groups: { id: number; title: string; pupils: number }[];
  lessons: Lesson[];
  nextDay: { date: string; items: { title: string; start: string }[] } | null;
  pending: { works: number; tasks: { id: number; groupId: number; group: string; level: string; name: string; note: string; deadline: string | null; deadlineText: string; total: number; checked: number; left: number }[] };
  firstLessons: { id: number; name: string; group: string; date: string | null; time: string }[];
  staffTasks: { id: number; title: string; deadline: string; by: string }[];
  salary: { month: string; base: number; percent: number | null; total: number | null; avans: number; left: number | null } | null;
}

export default function TeacherHomeV2({ teacher }: { teacher?: string }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { data: d, error } = useReportData<Home>(`/api/teacher?view=home${teacherQs(teacher)}`);
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
  const L = (p: string) => teacherLink(p, teacher);
  const nowLesson = d.lessons.find((l) => l.state === "hozir") ?? null;
  const pendingHw = d.pending.tasks.length;
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const weekday = cap(fmt.weekday(d.today));

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-bg p-4 font-v2 text-v2-text sm:p-6">
      {d.who.preview ? (
        <NoticeBar icon={Eye}>
          {t("Rahbar ko'rinishi: {name} bosh sahifasi", { name: d.who.name })}
        </NoticeBar>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Bosh sahifa")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{[`${weekday}, ${fmt.dayMonth(d.today)}`, t("{time} holatiga", { time: d.now }), d.branch].filter(Boolean).join(" · ")}</p>
        </div>
        <Link href={L("/teacher-groups")} className={secondaryBtn}>
          <CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Guruhlarim")}
        </Link>
      </div>

      {/* «Keldim» bosilmagan — ogohlantirish (rasm «Keldim bosilmagan»). */}
      {!d.keldim && d.who.employeeId !== null && d.lessons.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-v2-md border border-v2-warning bg-v2-warning-bg px-4 py-3">
          <span className="min-w-0 flex-1 text-v2-small text-v2-text">
            <b className="font-semibold">{t("«Keldim» bosilmagan.")}</b> {t("Dars oynasi va davomat «Keldim»dan keyin ochiladi — ish vaqti shundan hisoblanadi.")}
          </span>
          <Link href="/xodim/keldim" className={primaryBtn}>
            {t("Keldim")}
          </Link>
        </div>
      ) : null}

      <div className="grid gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<CircleCheck className="size-5" strokeWidth={1.75} />} tone={d.keldim ? "success" : "warning"} value={d.keldim ? d.keldim.time : "—"} label={d.keldim ? (d.keldim.late ? t("Keldim · kechikib") : t("Keldim · vaqtida")) : t("Keldim bosilmagan")} />
        <Kpi icon={<CalendarDays className="size-5" strokeWidth={1.75} />} tone="brand" value={String(d.lessons.length)} label={nowLesson ? t("Bugungi dars · bittasi hozir") : t("Bugungi dars")} />
        <Kpi icon={<FileText className="size-5" strokeWidth={1.75} />} tone="warning" value={String(d.pending.works)} label={t("Tekshirilmagan ish · {n} ta vazifa", { n: pendingHw })} />
        <Kpi icon={<Wallet className="size-5" strokeWidth={1.75} />} tone="neutral" value={d.salary?.left != null ? `${fmtSum(d.salary.left)}` : "—"} unit={d.salary?.left != null ? t("so'm") : ""} label={t("Qolgan oylik · {month}", { month: fmt.monthLower(d.today.slice(0, 7)) })} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle title={t("Bugungi darslar")} sub={[`${weekday}, ${fmt.dayMonth(d.today)}`, t("{n} ta dars", { n: d.lessons.length }), t("qadamlar: davomat → mavzu → uy vazifasi → tanga")].join(" · ")} />
            </div>
            {d.lessons.length === 0 ? (
              <p className="px-5 pb-5 text-v2-small text-v2-text-3">{t("Bugun darsingiz yo'q.")}</p>
            ) : (
              d.lessons.map((l) => <LessonRow key={l.groupId} l={l} href={L(`/teacher-lesson?groupId=${l.groupId}`)} checkHref={L("/teacher-check")} />)
            )}
            {d.nextDay ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-v2-border bg-v2-surface-2 px-5 py-3 text-v2-small text-v2-text-2">
                <span>
                  {cap(fmt.weekday(d.nextDay.date))}, {fmt.dayMonth(d.nextDay.date)}: {d.nextDay.items.map((x) => `${x.title} ${x.start}`).join(" · ")}
                  {d.firstLessons.length ? ` — ${t("birinchi darsga {n} kishi keladi", { n: d.firstLessons.length })}` : ""}
                </span>
                <Link href={L("/teacher-groups")} className="inline-flex items-center gap-1 font-medium text-v2-brand-text">
                  {t("Guruhlarim")}
                  <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                </Link>
              </div>
            ) : null}
          </Card>

          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <CardTitle
                title={t("Tekshirilmagan uy vazifalari")}
                sub={[t("{n} ta ish", { n: d.pending.works }), t("{n} guruh", { n: new Set(d.pending.tasks.map((x) => x.groupId)).size }), t("✓ yoki × va ball qo'yasiz, tanga o'zi yoziladi")].join(" · ")}
                right={
                  <Link href={L("/teacher-check")} className={secondaryBtn}>
                    {t("Hammasini ochish")}
                  </Link>
                }
              />
            </div>
            {d.pending.tasks.length === 0 ? (
              <p className="px-5 pb-5 text-v2-small text-v2-success">{t("Hamma ish tekshirilgan.")}</p>
            ) : (
              <ul className="divide-y divide-v2-border border-t border-v2-border">
                {d.pending.tasks.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-v2-md bg-v2-warning-bg text-v2-warning">
                      <FileText className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-v2-body font-semibold text-v2-text">{x.name}</span>
                        <FanPill course={x.group}>{x.level || x.group}</FanPill>
                      </div>
                      <div className="text-v2-caption text-v2-text-3">
                        {[x.deadline ? t("muddat {date}", { date: x.deadline === d.today ? t("bugun") : fmt.dayMonth(x.deadline) }) : x.deadlineText, t("tekshirildi {a} / {b}", { a: x.checked, b: x.total })].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span className="hidden shrink-0 text-v2-small text-v2-text-2 sm:block">
                      <b className="font-semibold text-v2-text">{x.left}</b> {t("ta ish")}
                    </span>
                    <Link href={L(`/teacher-check?taskId=${x.id}`)} className={secondaryBtn}>
                      {t("Tekshirish")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle title={t("Rolingiz: O'qituvchi")} sub={[d.branch, t("o'z guruhlaringiz · huquqlarni rahbar belgilaydi")].filter(Boolean).join(" · ")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-v2-caption font-semibold text-v2-text-2">{t("Ko'rasiz")}</div>
                {[t("O'z guruhlaringiz va o'quvchilari"), t("Dars, vazifa, tanga, imtihon"), t("Oyligingiz")].map((x) => (
                  <div key={x} className="flex items-center gap-2 py-1 text-v2-small text-v2-text">
                    <Check className="size-4 text-v2-success" strokeWidth={2} aria-hidden />
                    {x}
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1.5 text-v2-caption font-semibold text-v2-text-2">{t("Ko'rinmaydi")}</div>
                {[t("To'lovlar, kassa, qarzdorlar"), t("Lidlar ro'yxati"), t("Boshqa guruhlar, sozlamalar")].map((x) => (
                  <div key={x} className="flex items-center gap-2 py-1 text-v2-small text-v2-text-2">
                    <X className="size-4 text-v2-text-3" strokeWidth={2} aria-hidden />
                    {x}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {d.salary ? (
            <Card>
              <CardTitle
                title={t("Oyligim · {month}", { month: fmt.monthLower(d.salary.month) })}
                sub={d.salary.percent !== null ? t("tushumdan {p}%", { p: d.salary.percent }) : t("foiz belgilanmagan")}
              />
              <ul className="divide-y divide-v2-border">
                <SalaryRow label={t("Jami oylik")} sub={d.salary.percent !== null ? `${t("tushum")} ${fmtSum(d.salary.base)} × ${d.salary.percent}%` : ""} value={d.salary.total} />
                <SalaryRow label={t("Chiqarilgan avans va oylik")} value={d.salary.avans} />
                <SalaryRow label={t("Qolgan oylik")} sub={t("{date} holatiga · o'quvchilar to'lagani sari oshadi", { date: fmt.dayMonth(d.today) })} value={d.salary.left} big />
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardTitle title={t("Birinchi darsga keladiganlar")} sub={t("guruhlaringizga · shu hafta")} right={<span className="grid size-6 place-items-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2">{d.firstLessons.length}</span>} />
            {d.firstLessons.length === 0 ? (
              <p className="text-v2-small text-v2-text-3">{t("Bu hafta birinchi darsga yozilgan yo'q.")}</p>
            ) : (
              <ul className="space-y-3">
                {d.firstLessons.map((x) => (
                  <li key={x.id} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2">{x.name.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-v2-body font-semibold text-v2-text">{x.name}</div>
                      <div className="text-v2-caption text-v2-text-3">{x.group}</div>
                    </div>
                    <div className="shrink-0 text-right text-v2-small">
                      <div className="font-semibold text-v2-text">{x.date ? fmt.dayMonth(x.date) : ""}</div>
                      <div className="text-v2-caption text-v2-text-3">{x.time}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex items-start gap-2 rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-caption text-v2-text-2">
              <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              {t("Lidning telefoni, qo'ng'iroqlari va to'lovi adminda. Sizga ism, guruh va birinchi dars vaqti ko'rinadi.")}
            </p>
          </Card>

          <Card>
            <CardTitle
              title={t("Topshiriqlarim")}
              sub={t("{n} ta ochiq", { n: d.staffTasks.length })}
              right={
                <Link href="/tasks" className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                  {t("Hammasi")}
                  <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                </Link>
              }
            />
            {d.staffTasks.length === 0 ? (
              <p className="text-v2-small text-v2-text-3">{t("Ochiq topshiriq yo'q.")}</p>
            ) : (
              <ul className="space-y-3">
                {d.staffTasks.map((x) => (
                  <li key={x.id} className="flex gap-3">
                    <ClipboardList className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                    <div className="min-w-0">
                      <div className="text-v2-body text-v2-text">{x.title}</div>
                      <div className="text-v2-caption text-v2-text-3">{[x.by, x.deadline ? t("muddat {date}", { date: x.deadline.slice(0, 10) }) : ""].filter(Boolean).join(" · ")}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, tone, value, unit, label }: { icon: React.ReactNode; tone: "success" | "warning" | "brand" | "neutral"; value: string; unit?: string; label: string }) {
  const cls = { success: "bg-v2-success-bg text-v2-success", warning: "bg-v2-warning-bg text-v2-warning", brand: "bg-v2-brand-bg text-v2-brand-text", neutral: "bg-v2-surface-2 text-v2-text-2" }[tone];
  return (
    <div className="flex items-center gap-3 bg-v2-surface px-3 py-3 sm:px-4 sm:py-4">
      <span className={`hidden size-10 shrink-0 place-items-center rounded-v2-md sm:grid ${cls}`}>{icon}</span>
      <div className="min-w-0">
        <div className={`text-[1.375rem] font-semibold leading-7 tabular-nums ${tone === "warning" && value !== "—" && value !== "0" ? "text-v2-warning" : "text-v2-text"}`}>
          {value}
          {unit ? <span className="ml-1 text-v2-small font-normal text-v2-text-2">{unit}</span> : null}
        </div>
        <div className="text-v2-caption text-v2-text-2">{label}</div>
      </div>
    </div>
  );
}

function SalaryRow({ label, sub, value, big }: { label: string; sub?: string; value: number | null; big?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className={`text-v2-body ${big ? "font-semibold" : ""} text-v2-text`}>{label}</div>
        {sub ? <div className="text-v2-caption text-v2-text-3">{sub}</div> : null}
      </div>
      <div className={`shrink-0 tabular-nums ${big ? "text-[1.25rem] font-semibold" : "text-v2-body"} text-v2-text`}>
        {value === null ? "—" : fmtSum(value)} <span className="text-v2-caption font-normal text-v2-text-3">so&apos;m</span>
      </div>
    </li>
  );
}

function LessonRow({ l, href, checkHref }: { l: Lesson; href: string; checkHref: string }) {
  const { t } = useT();
  const attDone = l.attendance.marked > 0;
  const steps: { title: string; sub: string; state: StepState }[] = [
    { title: t("Davomat"), sub: attDone ? t("{n} keldi", { n: l.attendance.came }) : l.state === "keyin" ? t("{time} da ochiladi", { time: l.start }) : t("belgilanmagan"), state: attDone ? "done" : "todo" },
    { title: t("Mavzu"), sub: l.topic ?? (l.state === "keyin" ? t("dars boshida") : t("yozilmagan")), state: l.topic ? "done" : "todo" },
    {
      title: t("Uy vazifasi"),
      sub: l.homework ?? (l.prevPending > 0 ? t("avval {n} ta ishni tekshiring", { n: l.prevPending }) : t("berilmagan")),
      state: l.homework ? "done" : l.prevPending > 0 ? "locked" : "todo",
    },
    { title: t("Tanga"), sub: l.activityLimit ? t("faollik {a} / {b}", { a: l.activity, b: l.activityLimit }) : t("dars oxirida"), state: l.closed ? "done" : "todo" },
  ];
  const badge =
    l.state === "hozir" ? (
      <span className="inline-flex items-center gap-1 rounded-v2-sm bg-v2-brand-bg px-2 py-0.5 text-v2-caption font-medium text-v2-brand-text">
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {t("Hozir · {n} daqiqa o'tdi", { n: Math.max(0, l.minutesFromStart ?? 0) })}
      </span>
    ) : l.state === "keyin" ? (
      <span className="rounded-v2-sm bg-v2-surface-2 px-2 py-0.5 text-v2-caption text-v2-text-2">{t("{time} da boshlanadi", { time: l.start })}</span>
    ) : (
      <span className="rounded-v2-sm bg-v2-success-bg px-2 py-0.5 text-v2-caption text-v2-success">{l.closed ? t("Yakunlandi") : t("Tugadi")}</span>
    );
  return (
    <div className="border-t border-v2-border px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-12 shrink-0 text-v2-small tabular-nums">
          <div className="font-semibold text-v2-text">{l.start}</div>
          <div className="text-v2-text-3">{l.end}</div>
        </div>
        <span className="w-0.5 self-stretch rounded-full bg-v2-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-v2-section text-v2-text">{l.title}</span>
            {badge}
          </div>
          <div className="text-v2-small text-v2-text-2">{[l.room ? `${l.room}-xona` : null, t("{n} o'quvchi", { n: l.pupils })].filter(Boolean).join(" · ")}</div>
        </div>
        {l.state === "keyin" && l.prevPending > 0 ? (
          <Link href={checkHref} className={secondaryBtn}>
            {t("Vazifalarni tekshirish")}
          </Link>
        ) : (
          <Link href={href} className={l.state === "hozir" ? primaryBtn : secondaryBtn}>
            <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Darsni ochish")}
          </Link>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <StepBox key={s.title} n={i + 1} title={s.title} sub={s.sub} state={s.state} />
        ))}
      </div>
    </div>
  );
}
