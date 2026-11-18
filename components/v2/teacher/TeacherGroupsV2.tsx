"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ChartColumn, ChevronRight, Coins, Eye, Flame, Loader2, Lock, MessageSquare, Search } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { Card, teacherLink, teacherQs } from "./teacherBits";

// YANGI VERSIYA — O'QITUVCHI · GURUHLARIM (45-qism, rasmlar «guruhlarim va o'quvchi kartasi (ko'rish)», telefonda
// «guruhlarim», «o'quvchi kartasi»). Guruh kartalari (o'quvchi, shu oy darslari, davomat %, mavsumiy baholangan),
// tanlangan guruh o'quvchilari jadvali (davomat, uy vazifasi, tanga, mavsumiy baho; sariq — oyda dars yoki vazifa
// qoldirgan) va o'ngda o'quvchi kartasi — FAQAT KO'RISH: to'lov, qarz, shartnoma va telefonlar ko'rinmaydi.
// Server — /api/teacher?view=groups | pupil (lib/teacherDesk.ts).

interface Pupil {
  pupilId: number;
  name: string;
  attended: number;
  lessons: number;
  hwDone: number;
  hwTotal: number;
  coins: number;
  season: number | null;
}
interface Group {
  id: number;
  title: string;
  course: string;
  day: string;
  start: string;
  end: string;
  room: string;
  lessonsThisMonth: number;
  attendancePct: number | null;
  seasonDone: number;
  nextLesson: string | null;
  pupils: Pupil[];
}
interface Board {
  ok: true;
  who: { name: string; preview: boolean };
  today: string;
  month: string;
  pupilsTotal: number;
  groups: Group[];
}
interface PupilCardData {
  ok: true;
  pupilId: number;
  name: string;
  groups: { id: number; title: string; course: string; teacher: string; mine: boolean }[];
  attendance: { came: number; total: number };
  homework: { done: number; total: number };
  coins: { balance: number; earned: number };
  attendanceCoins: number;
  season: { season: string; criteria: { name: string; score: number }[]; note: string; by: string } | null;
  parents: { name: string }[];
}

export default function TeacherGroupsV2({ teacher }: { teacher?: string }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { data, error } = useReportData<Board>(`/api/teacher?view=groups${teacherQs(teacher)}`);
  const [gid, setGid] = useState<number | null>(null);
  const [pid, setPid] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const g = data?.groups.find((x) => x.id === gid) ?? data?.groups[0] ?? null;
  const pupils = useMemo(() => (g?.pupils ?? []).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())), [g, q]);
  const selPid = pid && g?.pupils.some((p) => p.pupilId === pid) ? pid : (g?.pupils[0]?.pupilId ?? null);

  if (error)
    return (
      <div data-ui="v2" className="p-4">
        <NoticeBar>{t("Ma'lumot yuklanmadi")}</NoticeBar>
      </div>
    );
  if (!data)
    return (
      <div data-ui="v2" className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const L = (p: string) => teacherLink(p, teacher);
  const monthShort = fmt.monthLower(data.month).slice(0, 3);

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-bg p-4 font-v2 text-v2-text sm:p-6">
      {data.who.preview ? <NoticeBar icon={Eye}>{t("Rahbar ko'rinishi: {name}", { name: data.who.name })}</NoticeBar> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Guruhlarim")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{[t("{n} ta guruh", { n: data.groups.length }), t("{n} o'quvchi", { n: data.pupilsTotal }), fmt.dayMonth(data.today)].join(" · ")}</p>
        </div>
        <div className="flex gap-2">
          <Link href={L("/home")} className={secondaryBtn}>
            <CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Bugungi darslar")}
          </Link>
          <Link href={L("/teacher-check")} className={secondaryBtn}>
            {t("Vazifalarni tekshirish")}
          </Link>
        </div>
      </div>

      {data.groups.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-v2-small text-v2-text-3">{t("Sizga biriktirilgan faol guruh yo'q.")}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.groups.map((x) => {
            const on = x.id === g?.id;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  setGid(x.id);
                  setPid(null);
                }}
                className={`rounded-v2-lg border bg-v2-surface p-4 text-left shadow-v2-sm transition-colors sm:p-5 ${on ? "border-v2-brand ring-1 ring-v2-brand" : "border-v2-border hover:bg-v2-surface-2"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 shrink-0 rounded-sm ${FAN_DOT[fanOf(x.course)]}`} aria-hidden />
                      <span className="truncate text-v2-section text-v2-text">{x.title}</span>
                    </div>
                    <div className="pl-4.5 text-v2-small text-v2-text-2">{[x.day, x.start && x.end ? `${x.start}–${x.end}` : null, x.room ? `${x.room}-xona` : null].filter(Boolean).join(" · ")}</div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[
                    [t("O'quvchi"), String(x.pupils.length)],
                    [t("Darslar · {m}", { m: monthShort }), String(x.lessonsThisMonth)],
                    [t("Davomat · {m}", { m: monthShort }), x.attendancePct !== null ? `${x.attendancePct}%` : "—"],
                    [t("Mavsumiy"), `${x.seasonDone} / ${x.pupils.length}`],
                  ].map(([a, b]) => (
                    <div key={a}>
                      <div className="text-v2-caption text-v2-text-3">{a}</div>
                      <div className="text-v2-body font-semibold tabular-nums text-v2-text">{b}</div>
                    </div>
                  ))}
                </div>
                {x.nextLesson ? (
                  <div className="mt-3 flex items-center gap-2 border-t border-v2-border pt-3 text-v2-small text-v2-text-2">
                    <CalendarDays className="size-4 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                    {t("Keyingi dars: {d}", { d: `${fmt.weekday(x.nextLesson)}, ${fmt.dayMonth(x.nextLesson)} ${x.start}` })}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {g ? (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <Card className="min-w-0 !p-0 sm:!p-0">
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
              <div>
                <h2 className="text-v2-section text-v2-text">{t("{g} — o'quvchilar", { g: g.title })}</h2>
                <p className="text-v2-small text-v2-text-3">{t("{n} kishi · guruhga qo'shish va ko'chirish adminda", { n: g.pupils.length })}</p>
              </div>
              <label className="relative block w-full sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Qidirish")} className="h-9 w-full rounded-v2-md border border-v2-border-strong bg-v2-surface pl-9 pr-3 text-v2-small outline-none focus:shadow-v2-focus" />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left">
                <thead>
                  <tr className="border-y border-v2-border bg-v2-surface-2 text-v2-caption text-v2-text-3">
                    <th className="px-5 py-2 font-medium">{t("O'quvchi")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("Davomat · {m}", { m: monthShort })}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("Uy vazifasi · {m}", { m: monthShort })}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("Tanga")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("Mavsumiy baho")}</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {pupils.map((p) => {
                    const on = p.pupilId === selPid;
                    const attWarn = p.lessons > 0 && p.attended < p.lessons;
                    const hwWarn = p.hwTotal > 0 && p.hwDone < p.hwTotal;
                    return (
                      <tr key={p.pupilId} onClick={() => setPid(p.pupilId)} className={`cursor-pointer border-b border-v2-border text-v2-small ${on ? "bg-v2-brand-bg shadow-[inset_3px_0_0_var(--v2-brand)]" : "hover:bg-v2-surface-2"}`}>
                        <td className="px-5 py-2.5">
                          <span className="flex items-center gap-3">
                            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v2-info-bg text-[0.6875rem] font-semibold text-v2-info">{initialsOf(p.name)}</span>
                            <span className="font-semibold text-v2-text">{p.name}</span>
                          </span>
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${attWarn ? "text-v2-warning" : "text-v2-text"}`}>{p.lessons ? `${p.attended} / ${p.lessons}` : "—"}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${hwWarn ? "text-v2-warning" : "text-v2-text"}`}>{p.hwTotal ? `${p.hwDone} / ${p.hwTotal}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">
                          <Coins className="mr-1 inline size-3.5 text-v2-warning" strokeWidth={1.75} aria-hidden />
                          {p.coins}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${p.season === null ? "text-v2-text-3" : p.season < 3.5 ? "font-semibold text-v2-warning" : "font-semibold text-v2-text"}`}>{p.season === null ? t("baholanmagan") : String(p.season).replace(".", ",")}</td>
                        <td className="pr-4 text-v2-text-3">
                          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-v2-caption text-v2-text-3">
              <span className="flex items-center gap-1.5">
                <Lock className="size-3.5" strokeWidth={1.75} aria-hidden />
                {t("To'lov holati va qarzlar bu ro'yxatda yo'q — ular admin va menejerda.")}
              </span>
              <span>{t("Sariq — {m}da dars yoki vazifa qoldirgan", { m: fmt.monthLower(data.month) })}</span>
            </div>
          </Card>

          {selPid ? <PupilCard key={`${g.id}:${selPid}`} groupId={g.id} pupilId={selPid} teacher={teacher} month={data.month} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function PupilCard({ groupId, pupilId, teacher, month: monthKey }: { groupId: number; pupilId: number; teacher?: string; month: string }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { data: d } = useReportData<PupilCardData>(`/api/teacher?view=pupil&groupId=${groupId}&pupilId=${pupilId}${teacherQs(teacher)}`);
  if (!d)
    return (
      <section className="flex h-48 items-center justify-center rounded-v2-lg border border-v2-border bg-v2-surface">
        <Loader2 className="size-5 animate-spin text-v2-text-3" aria-hidden />
      </section>
    );
  const month = fmt.monthLower(monthKey);
  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-v2-info-bg text-v2-body font-semibold text-v2-info">{initialsOf(d.name)}</span>
          <div className="min-w-0">
            <div className="text-v2-section text-v2-text">{d.name}</div>
            {d.attendanceCoins > 0 ? (
              <div className="flex items-center gap-1 text-v2-caption text-v2-text-2">
                <Flame className="size-3.5 text-v2-danger" strokeWidth={1.75} aria-hidden />
                {t("{n} dars keldi · {m}", { n: d.attendance.came, m: month })}
              </div>
            ) : null}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-v2-full bg-v2-surface-2 px-2 py-0.5 text-v2-caption text-v2-text-2">
          <Eye className="size-3.5" strokeWidth={1.75} aria-hidden />
          {t("Faqat ko'rish")}
        </span>
      </div>
      <ul className="mt-3 space-y-1">
        {d.groups.map((x) => (
          <li key={x.id} className="flex items-center gap-2 text-v2-small">
            <span className={`size-2 rounded-full ${FAN_DOT[fanOf(x.course)]}`} aria-hidden />
            <span className="text-v2-text">{x.title}</span>
            <span className="text-v2-text-3">— {x.mine ? t("siz") : x.teacher}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          [t("Davomat · {m}", { m: month }), `${d.attendance.came} / ${d.attendance.total}`, ""],
          [t("Uy vazifasi · {m}", { m: month }), d.homework.total ? `${d.homework.done} / ${d.homework.total}` : "—", ""],
          [t("Tanga"), String(d.coins.balance), t("jami topgan {n}", { n: d.coins.earned })],
          [t("Mavsumiy baho"), d.season ? String(avg(d.season.criteria) ?? "—").replace(".", ",") : "—", d.season ? d.season.season : ""],
        ].map(([a, b, c]) => (
          <div key={a} className="rounded-v2-md border border-v2-border px-3 py-2">
            <div className="text-v2-caption text-v2-text-3">{a}</div>
            <div className="text-v2-section font-semibold tabular-nums text-v2-text">{b}</div>
            {c ? <div className="text-v2-caption text-v2-text-3">{c}</div> : null}
          </div>
        ))}
      </div>
      {d.season ? (
        <div className="mt-4 border-t border-v2-border pt-3">
          <div className="mb-2 text-v2-small font-semibold text-v2-text">{t("Mavsumiy baholash · {by}", { by: d.season.by || t("siz") })}</div>
          <ul className="space-y-1.5">
            {d.season.criteria.map((c) => (
              <li key={c.name} className="grid grid-cols-[6.5rem_minmax(0,1fr)_1.5rem] items-center gap-2 text-v2-small">
                <span className="text-v2-text-2">{t(c.name)}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-v2-track">
                  <span className="block h-full rounded-full bg-v2-brand" style={{ width: `${(c.score / 5) * 100}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums text-v2-text">{c.score || "—"}</span>
              </li>
            ))}
          </ul>
          {d.season.note ? <p className="mt-2 text-v2-small text-v2-text-2">{t("Izohingiz:")} «{d.season.note}»</p> : null}
        </div>
      ) : null}
      <div className="mt-4 border-t border-v2-border pt-3">
        {d.parents.length ? (
          d.parents.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-full bg-v2-violet-bg text-v2-caption font-semibold text-v2-violet">{initialsOf(p.name || "OO")}</span>
                <span>
                  <span className="block text-v2-small font-semibold text-v2-text">{p.name || t("Ota-ona")}</span>
                  <span className="block text-v2-caption text-v2-text-3">{t("Ota-ona · Telegram botga ulangan")}</span>
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-v2-caption text-v2-text-3" title={t("Botga xabar — tez orada")}>
                <MessageSquare className="size-3.5" strokeWidth={1.75} aria-hidden />
                {t("tez orada")}
              </span>
            </div>
          ))
        ) : (
          <p className="text-v2-small text-v2-text-3">{t("Ota-ona Telegram botga ulanmagan.")}</p>
        )}
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-v2-md border border-dashed border-v2-border-strong px-3 py-2 text-v2-caption text-v2-text-2">
        <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        {t("To'lovlar, qarz va shartnoma ustozga ko'rinmaydi — bu admin va menejerda.")}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={`/gamification-lesson?groupId=${groupId}`} className={`${secondaryBtn} justify-center`}>
          ± {t("Tanga")}
        </Link>
        <Link href={`/imtihon`} className={`${secondaryBtn} justify-center`}>
          <ChartColumn className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Natijalari")}
          <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

const avg = (c: { score: number }[]) => {
  const v = c.map((x) => x.score).filter((x) => x >= 1 && x <= 5);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};
