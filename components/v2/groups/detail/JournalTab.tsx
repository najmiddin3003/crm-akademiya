"use client";

import { useRef, useState } from "react";
import { CalendarX2, Check, CircleAlert, Clock3, Sparkles, Trash2, Users } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import V2MonthNav from "@/components/v2/ui/V2MonthNav";
import { EmptyBlock, KpiCell, KpiStrip, MarkIcon, PUPIL_TONE, ToneBadge, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { WEEKDAYS_SHORT } from "@/lib/i18n";
import type { AttendanceMark, AttendanceStatus } from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import { carryOver, postMark, upsertMark } from "./attendanceApi";
import { cameStatus, editDenial, isFrozenPupil, lessonIsosOf, memberName, signed, type Member } from "./groupDetailBits";
import { useGamView, useMonthMarks } from "./useGroupDetail";

// YANGI VERSIYA — «DAVOMAT JURNALI» (rasm «Guruh · Davomat jurnali», yorug'/qorong'i,
// 24.10.2026): oy bo'yicha jadval — qatorda o'quvchi, ustunda dars kunlari (bugungisi
// ajratilgan), o'ngda davomat foizi va oy tangalari; pastda «Kelganlar» (kelgan /
// belgilangan). Tepada 4 ko'rsatkich: o'rtacha davomat, o'tgan darslar, diqqat talab
// (70% dan past), berilgan tanga (gamifikatsiya bo'lsa).
//
// Foiz = kelgan (keldi, kechikdi, birinchi dars) / belgilangan dars (sababli ham
// hisobga kiradi — rasmdagi 4/5 = 80%). Katak bosilsa — belgi tuzatiladi (darhol
// yoziladi, cheklov — «Bugungi dars» bilan bir xil). Dars sarlavhasi — o'sha darsni
// «Bugungi dars» tabida ochadi.

const LOW = 70;

const MENU: { status: AttendanceStatus; label: string }[] = [
  { status: "keldi", label: "Keldi" },
  { status: "kechikdi", label: "Kechikdi" },
  { status: "sababsiz", label: "Kelmadi" },
  { status: "sababli", label: "Sababli" },
  { status: "birinchi", label: "Birinchi dars" },
];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  keldi: "Keldi",
  kechikdi: "Kechikdi",
  sababsiz: "Kelmadi",
  sababli: "Sababli",
  birinchi: "Birinchi dars",
};

function MenuIcon({ status }: { status: AttendanceStatus }) {
  if (status === "kechikdi")
    return (
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-v2-warning-bg text-v2-warning" aria-hidden>
        <Clock3 className="size-3" strokeWidth={2.25} />
      </span>
    );
  if (status === "birinchi")
    return (
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-v2-info-bg text-v2-info" aria-hidden>
        <Sparkles className="size-3" strokeWidth={2.25} />
      </span>
    );
  return <MarkIcon status={status} size="sm" />;
}

export default function JournalTab({
  group,
  members,
  today,
  month,
  onMonth,
  onOpenLesson,
}: {
  group: Group & { branchId?: number | null };
  members: Member[] | null;
  today: string;
  /** "YYYY-MM". */
  month: string;
  onMonth: (key: string) => void;
  /** Dars sarlavhasi bosilganda — o'sha dars «Bugungi dars» tabida. */
  onOpenLesson: (iso: string) => void;
}) {
  const { t, lang } = useT();
  const fmt = useProfileFmt();
  const { showError } = useToast();
  const canProfile = useCanOpen("/students-list");
  const { marks, patch } = useMonthMarks(group.id, month);
  const { view, reload: reloadView } = useGamView(group.id, month);
  const [cell, setCell] = useState<{ pupilId: number; name: string; iso: string } | null>(null);
  const cellRef = useRef<HTMLElement | null>(null);

  const gam = view && view.enabled && view.group ? view : null;
  const lessons = lessonIsosOf(group, month);
  const past = lessons.filter((d) => d <= today);
  const ready = marks !== null && members !== null && view !== undefined;

  // pupilId → (sana → belgi)
  const byPupil = new Map<number, Map<string, AttendanceMark>>();
  for (const m of marks ?? []) {
    if (!byPupil.has(m.pupilId)) byPupil.set(m.pupilId, new Map());
    byPupil.get(m.pupilId)?.set(m.date, m);
  }
  const lastLesson = lessons[lessons.length - 1] ?? `${month}-31`;
  const rows = (members ?? [])
    .filter((m) => byPupil.has(m.id) || (!isFrozenPupil(m.status) && (!m.joinedAt || m.joinedAt <= lastLesson)))
    .sort((a, b) => memberName(a).localeCompare(memberName(b), "uz"))
    .map((m) => {
      const own = byPupil.get(m.id) ?? new Map<string, AttendanceMark>();
      let came = 0;
      let marked = 0;
      for (const d of past) {
        const x = own.get(d);
        if (!x) continue;
        marked += 1;
        if (cameStatus(x.status)) came += 1;
      }
      const coins = gam ? Number(gam.monthCoins?.[String(m.id)] ?? 0) : 0;
      const frozen = isFrozenPupil(m.status);
      return { m, name: memberName(m) || t("Nomsiz o'quvchi"), own, came, marked, pct: marked ? Math.round((came / marked) * 100) : null, coins, frozen };
    });

  const totalCame = rows.reduce((s, r) => s + r.came, 0);
  const totalMarked = rows.reduce((s, r) => s + r.marked, 0);
  const avg = totalMarked ? Math.round((totalCame / totalMarked) * 100) : null;
  const low = rows.filter((r) => r.pct !== null && r.pct < LOW).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  const coinTotal = rows.reduce((s, r) => s + r.coins, 0);
  const coinPupils = rows.filter((r) => r.coins !== 0).length;
  const monthLow = fmt.monthLower(month);
  const monthShort = lang === "en" ? fmt.monthShort(month) : fmt.monthShort(month).toLowerCase();
  const wd = WEEKDAYS_SHORT[lang] ?? WEEKDAYS_SHORT.uz;

  async function setMark(pupilId: number, iso: string, status: AttendanceStatus | null) {
    const prev = byPupil.get(pupilId)?.get(iso);
    setCell(null);
    if ((prev?.status ?? null) === status) return;
    const body = { pupilId, date: iso, status, ...carryOver(prev, status) };
    const optimistic: AttendanceMark | null = status ? { groupId: group.id, pupilId, date: iso, status, grade: body.grade as AttendanceMark["grade"], reason: body.reason, note: body.note } : null;
    patch((ms) => upsertMark(ms, pupilId, iso, optimistic));
    const res = await postMark(group.id, body);
    if (!res.ok) {
      patch((ms) => upsertMark(ms, pupilId, iso, prev ?? null));
      showError(t(res.error));
      return;
    }
    patch((ms) => upsertMark(ms, pupilId, iso, res.mark));
    if (gam) void reloadView();
  }

  const cellPrev = cell ? byPupil.get(cell.pupilId)?.get(cell.iso) : undefined;
  const cellDenial = cell ? editDenial(view, cell.iso, today) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Ko'rsatkichlar ── */}
      <KpiStrip cols={gam ? 4 : 3} label={t("Oy ko'rsatkichlari")}>
        <KpiCell label={t("O'rtacha davomat · {month}", { month: monthLow })} value={avg === null ? "—" : `${avg}%`} sub={t("{came} / {marked} qatnashuv", { came: totalCame, marked: totalMarked })}>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-v2-full bg-v2-hover" aria-hidden>
            <span className="block h-full rounded-v2-full bg-v2-brand" style={{ width: `${avg ?? 0}%` }} />
          </span>
        </KpiCell>
        <KpiCell
          label={t("O'tgan darslar")}
          value={past.length}
          sub={lessons.length ? t("{total} tadan · {ahead} tasi oldinda", { total: lessons.length, ahead: lessons.length - past.length }) : t("Bu oyda dars yo'q")}
        />
        <KpiCell
          icon={<CircleAlert className={`size-4 ${low.length ? "text-v2-danger" : "text-v2-text-3"}`} strokeWidth={1.75} aria-hidden />}
          label={t("Diqqat talab")}
          value={t("{n} o'quvchi", { n: low.length })}
          sub={
            low.length === 0
              ? totalMarked
                ? t("Hammasi {pct}% dan yuqori", { pct: LOW })
                : "—"
              : low.length === 1
                ? `${low[0].name} · ${low[0].pct}%`
                : t("{name} · {pct}% va yana {n} ta", { name: low[0].name, pct: low[0].pct ?? 0, n: low.length - 1 })
          }
        />
        {gam && <KpiCell label={t("Berilgan tanga · {month}", { month: monthLow })} value={signed(coinTotal)} sub={t("{n} o'quvchiga", { n: coinPupils })} />}
      </KpiStrip>

      {/* ── Oy va belgilar izohi ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <V2MonthNav value={month} onChange={onMonth} current={today.slice(0, 7)} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-v2-caption text-v2-text-2" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <MarkIcon status="keldi" size="sm" />
            {t("Keldi")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MarkIcon status="sababsiz" size="sm" />
            {t("Kelmadi")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MarkIcon status="sababli" size="sm" />
            {t("Sababli")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-v2-text-3" />
            {t("Rejada")}
          </span>
        </div>
      </div>

      {/* ── Jadval ── */}
      <div className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        {!ready ? (
          <div className="space-y-2 p-4" aria-busy>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-7 rounded-v2-md bg-v2-skeleton" />
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <EmptyBlock icon={<CalendarX2 className="size-5" strokeWidth={1.75} />} title={t("Bu oyda dars yo'q")} text={t("Guruh muddati yoki dars kunlari bu oyni qamramaydi.")} />
        ) : rows.length === 0 ? (
          <EmptyBlock icon={<Users className="size-5" strokeWidth={1.75} />} title={t("Guruhda hali o'quvchi yo'q")} />
        ) : (
          <div className="relative overflow-x-auto overflow-y-hidden">
            <table className="w-full min-w-max border-separate border-spacing-0 text-v2-small">
              <thead>
                <tr className="whitespace-nowrap text-v2-caption text-v2-text-2">
                  <th scope="col" className="sticky left-0 z-[1] min-w-[11rem] border-b border-v2-border bg-v2-surface-2 px-4 py-2 text-left font-medium">
                    {t("O'quvchi")}
                  </th>
                  {lessons.map((d) => {
                    const isToday = d === today;
                    const day = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
                    return (
                      <th key={d} scope="col" className={`w-10 min-w-10 border-b border-v2-border px-0.5 py-1.5 text-center font-medium ${isToday ? "bg-v2-brand-bg" : "bg-v2-surface-2"}`}>
                        <button
                          type="button"
                          onClick={() => onOpenLesson(d)}
                          title={t("Darsni ochish — {date}", { date: fmt.dayMonth(d) })}
                          className="flex w-full flex-col items-center rounded-v2-sm py-0.5 leading-tight hover:bg-v2-hover focus-visible:outline-none focus-visible:shadow-v2-focus"
                        >
                          <span className={`text-v2-small font-semibold tabular-nums ${isToday ? "text-v2-brand-text" : "text-v2-text"}`}>{Number(d.slice(8, 10))}</span>
                          <span className={`text-[10px] ${isToday ? "font-semibold text-v2-brand-text" : "text-v2-text-3"}`}>{isToday ? t("bugun") : wd[day.getDay()]}</span>
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="w-20 border-b border-v2-border bg-v2-surface-2 px-3 py-2 text-right font-medium">
                    {t("Davomat")}
                  </th>
                  {gam && (
                    <th scope="col" className="w-20 border-b border-v2-border bg-v2-surface-2 px-4 py-2 text-right font-medium">
                      {t("Tanga · {month}", { month: monthShort })}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.m.id} className="group/row">
                    <th scope="row" className="sticky left-0 z-[1] border-b border-v2-border bg-v2-surface px-4 py-1.5 text-left font-normal group-hover/row:bg-v2-surface-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[10px] font-semibold text-v2-text-2" aria-hidden>
                          {initialsOf(r.name)}
                        </span>
                        {canProfile ? (
                          <Link href={`/student-edit/${r.m.id}?src=list`} className="truncate font-semibold text-v2-text underline-offset-2 hover:underline">
                            {r.name}
                          </Link>
                        ) : (
                          <span className="truncate font-semibold text-v2-text">{r.name}</span>
                        )}
                        {r.frozen && r.m.status && (
                          <ToneBadge tone={PUPIL_TONE[r.m.status === "Arxiv" ? "Arxiv" : "Muzlatilgan"]}>{t(r.m.status === "Arxiv" ? "Arxiv" : "Muzlatilgan")}</ToneBadge>
                        )}
                      </span>
                    </th>
                    {lessons.map((d) => {
                      const isToday = d === today;
                      const x = r.own.get(d);
                      // Qo'shilishidan oldingi kun va muzlatilgan o'quvchining belgisiz darsi — bo'sh katak.
                      const before = (!!r.m.joinedAt && d < r.m.joinedAt && !x) || (r.frozen && !x);
                      const tint = isToday ? "bg-v2-brand-bg" : "group-hover/row:bg-v2-surface-2";
                      if (before) return <td key={d} className={`border-b border-v2-border ${tint}`} />;
                      if (d > today && !x)
                        return (
                          <td key={d} className={`border-b border-v2-border text-center ${tint}`}>
                            <span className="inline-block size-1.5 rounded-full bg-v2-text-3 opacity-60" aria-label={t("Rejada")} />
                          </td>
                        );
                      const label = `${r.name} · ${fmt.dayMonth(d)}: ${x ? t(STATUS_LABEL[x.status]) : t("belgilanmagan")}${x?.note ? ` — ${x.note}` : ""}`;
                      return (
                        <td key={d} className={`border-b border-v2-border p-0 text-center ${tint}`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              cellRef.current = e.currentTarget;
                              setCell((c) => (c && c.pupilId === r.m.id && c.iso === d ? null : { pupilId: r.m.id, name: r.name, iso: d }));
                            }}
                            title={label}
                            aria-label={label}
                            aria-haspopup="menu"
                            className={`inline-flex size-8 items-center justify-center rounded-v2-md transition-colors hover:bg-v2-hover focus-visible:outline-none focus-visible:shadow-v2-focus ${
                              cell && cell.pupilId === r.m.id && cell.iso === d ? "shadow-v2-focus" : ""
                            }`}
                          >
                            <MarkIcon status={x ? x.status : "unmarked"} size="sm" />
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b border-v2-border px-3 py-1.5 text-right group-hover/row:bg-v2-surface-2">
                      {r.pct === null ? (
                        <span className="text-v2-text-3">—</span>
                      ) : r.pct < LOW ? (
                        <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-v2-danger">
                          <CircleAlert className="size-3.5" strokeWidth={2} aria-hidden />
                          {r.pct}%
                        </span>
                      ) : (
                        <span className="font-semibold tabular-nums text-v2-text">{r.pct}%</span>
                      )}
                    </td>
                    {gam && (
                      <td className="border-b border-v2-border px-4 py-1.5 text-right font-semibold tabular-nums text-v2-text group-hover/row:bg-v2-surface-2">
                        {r.coins === 0 ? <span className="font-normal text-v2-text-3">0</span> : signed(r.coins)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-v2-small">
                  <th scope="row" className="sticky left-0 z-[1] bg-v2-surface-2 px-4 py-2 text-left font-semibold text-v2-text">
                    {t("Kelganlar")}
                  </th>
                  {lessons.map((d) => {
                    let came = 0;
                    let marked = 0;
                    for (const r of rows) {
                      const x = r.own.get(d);
                      if (!x) continue;
                      marked += 1;
                      if (cameStatus(x.status)) came += 1;
                    }
                    return (
                      <td key={d} className={`px-0.5 py-2 text-center tabular-nums ${d === today ? "bg-v2-brand-bg" : "bg-v2-surface-2"} ${marked ? "font-semibold text-v2-text" : "text-v2-text-3"}`}>
                        {marked ? `${came}/${marked}` : "–"}
                      </td>
                    );
                  })}
                  <td className="bg-v2-surface-2 px-3 py-2 text-right font-semibold tabular-nums text-v2-text">{avg === null ? "—" : `${avg}%`}</td>
                  {gam && <td className="bg-v2-surface-2 px-4 py-2 text-right font-semibold tabular-nums text-v2-text">{signed(coinTotal)}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      {ready && lessons.length > 0 && rows.length > 0 && (
        <p className="text-v2-caption text-v2-text-2">{t("Katakni bosib belgini tuzatish mumkin. {pct}% dan past davomat qizil bilan ajratiladi.", { pct: LOW })}</p>
      )}

      {/* ── Katak menyusi ── */}
      {cell && (
        <FloatingPanel open anchorRef={cellRef} onClose={() => setCell(null)} align="start" width={240} maxHeight={420} role="menu" ariaLabel={t("Davomat belgisi")}>
          <div data-ui="v2" className="font-v2 text-v2-text">
            <div className="border-b border-v2-border px-3 py-2">
              <div className="truncate text-v2-small font-semibold">{cell.name}</div>
              <div className="text-v2-caption text-v2-text-2">
                {fmt.dayMonth(cell.iso)} · {fmt.weekday(cell.iso)}
              </div>
            </div>
            {cellDenial && <p className="border-b border-v2-border bg-v2-warning-bg px-3 py-2 text-v2-caption text-v2-text">{t(cellDenial)}</p>}
            <div className="p-1">
              {MENU.map((o) => {
                const on = cellPrev?.status === o.status;
                return (
                  <button
                    key={o.status}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    disabled={!!cellDenial}
                    onClick={() => void setMark(cell.pupilId, cell.iso, o.status)}
                    className="flex w-full items-center gap-2 rounded-v2-md px-2 py-1.5 text-left text-v2-small hover:bg-v2-surface-2 focus-visible:bg-v2-surface-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <MenuIcon status={o.status} />
                    <span className={`flex-1 ${on ? "font-semibold" : ""}`}>{t(o.label)}</span>
                    {on && <Check className="size-4 text-v2-brand-text" strokeWidth={2.25} aria-hidden />}
                  </button>
                );
              })}
              {cellPrev && (
                <>
                  <div className="my-1 h-px bg-v2-border" />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!!cellDenial}
                    onClick={() => void setMark(cell.pupilId, cell.iso, null)}
                    className="flex w-full items-center gap-2 rounded-v2-md px-2 py-1.5 text-left text-v2-small text-v2-danger hover:bg-v2-danger-bg focus-visible:bg-v2-danger-bg focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                    {t("Belgini olib tashlash")}
                  </button>
                </>
              )}
            </div>
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}
