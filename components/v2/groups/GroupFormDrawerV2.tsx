"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronDown, TriangleAlert } from "lucide-react";
import Link from "@/components/ui/Link";
import { useRouter } from "next/navigation";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import { IsoDateField } from "@/components/v2/students/lists/listKit";
import V2TimeField from "@/components/v2/form/V2TimeField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, Segmented, TextInput, fieldCls } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { useGroups } from "@/hooks/useGroups";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useRooms } from "@/hooks/useRooms";
import { useTeachers } from "@/hooks/useTeachers";
import { groupWeekdays } from "@/lib/attendance";
import { monthlyPriceFor, type PricedCourse } from "@/lib/coursePrice";
import { courseLevelNames, findCourseByName } from "@/lib/courseLevels";
import { GROUP_WEEK, groupDayValue } from "@/lib/groupDays";
import { findRoomConflict, joinTime, missingGroupFields, parseTimeRange } from "@/lib/groupRules";
import type { Group } from "@/lib/groups";
import { uzDateIso } from "@/lib/uzTime";

// YANGI VERSIYA — «YANGI GURUH» / GURUHNI TAHRIRLASH (31-qism, rasm «Yangi guruh», yorug'/qorong'i).
//
// O'ngdan panel. Bo'limlar: Guruh (nomi, kurs, daraja, oylik narx, sig'im, holat, ta'lim turi) →
// Dars jadvali (kunlar, boshlanish sanasi, vaqti, davomiyligi, o'qituvchi + yordamchi, xona kartalari)
// → «Qo'shimcha» (Telegram havola, tugash sanasi). Saqlash eski oyna bilan BIR XIL so'rov
// (POST /api/groups, PATCH /api/groups/:id) va bir xil tekshiruvlar (lib/groupRules.ts); serverdagi
// xona bandligi (409) oxirgi so'z. Yangi: `capacity` (sig'im). Oylik narx guruhda saqlanmaydi —
// kurs/daraja narxidan (Sozlamalar → Kurslar) ko'rsatiladi (SAVOLLAR 424). O'qituvchi bandligi xona
// bandligi qoidasi bilan (shu kunlar va vaqtda boshqa guruhi bormi).

const DURATIONS = [60, 90, 120, 150, 180];
const PRESETS = ["Toq kunlar", "Juft kunlar", "Hafta kunlari"];

function addMinutes(hhmm: string, min: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return "";
  const total = Number(m[1]) * 60 + Number(m[2]) + min;
  if (total >= 24 * 60) return "";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
const fmt = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");
const normRoom = (r: string) => r.replace(/\s*-?\s*xona$/i, "").trim();

export default function GroupFormDrawerV2({ group, onClose, onSaved }: { group?: Group; onClose: () => void; onSaved?: (g: Group) => void }) {
  const { t } = useT();
  const router = useRouter();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const editing = group !== undefined;
  const { courses, activeNames } = useOfflineCourseList();
  const { names: teacherNames } = useTeachers();
  const { rooms } = useRooms();
  const { groups } = useGroups();

  const [t0, t1] = (group?.time || " - ").split(" - ").map((s) => s.trim());
  const initDuration = (() => {
    const r = parseTimeRange(group?.time || "");
    return r ? r[1] - r[0] : 120;
  })();
  const [name, setName] = useState(group?.name ?? "");
  const [course, setCourse] = useState(group?.course ?? "");
  const [level, setLevel] = useState(group?.level ?? "");
  const [capacity, setCapacity] = useState(String((group as Group & { capacity?: number })?.capacity ?? 12));
  const [status, setStatus] = useState(group?.status || "gathering");
  const [eduType, setEduType] = useState(group?.eduType || "Oflayn");
  const [day, setDay] = useState(group?.day || "Toq kunlar");
  const [customDays, setCustomDays] = useState(Boolean(group?.day && !PRESETS.includes(group.day)));
  const [startDate, setStartDate] = useState(group?.startDate || uzDateIso());
  const [startTime, setStartTime] = useState(t0 || "14:00");
  const [duration, setDuration] = useState(DURATIONS.includes(initDuration) ? initDuration : 120);
  const [teacher, setTeacher] = useState(group?.teacher ?? "");
  const [assistant, setAssistant] = useState(group?.assistant ?? "");
  const [room, setRoom] = useState(normRoom(group?.room ?? ""));
  const [moreOpen, setMoreOpen] = useState(false);
  const [telegram, setTelegram] = useState(group?.telegram ?? "");
  const [endDate, setEndDate] = useState(group?.endDate ?? "");
  const [thenAdd, setThenAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const endTime = addMinutes(startTime, duration) || t1 || "";
  const time = joinTime(startTime, endTime);
  const days = groupWeekdays(day);
  const dayAbbr = GROUP_WEEK.filter((d) => days.includes(d.wd)).map((d) => t(d.abbr)).join(", ");
  const levels = courseLevelNames(findCourseByName(courses, course));
  const price = course ? monthlyPriceFor({ course, level, branchId: branch.branchId }, courses as unknown as PricedCourse[]) : null;
  const cap = Number(capacity) || 0;
  const today = uzDateIso();
  const others = useMemo(() => groups.filter((g) => g.id !== group?.id), [groups, group?.id]);

  // Xonalar — shu kunlar va vaqtda bo'shmi (xona bandligi qoidasi), sig'imi yetadimi.
  const roomCards = useMemo(
    () =>
      rooms
        .map((r) => {
          const nm = normRoom(r.name);
          const clash = time && days.length ? findRoomConflict({ room: r.name, day, time, startDate, endDate }, others, today) ?? findRoomConflict({ room: nm, day, time, startDate, endDate }, others, today) : null;
          return { name: nm, capacity: Number(r.capacity) || 0, busy: clash };
        })
        .sort((a, b) => Number(Boolean(a.busy)) - Number(Boolean(b.busy)) || b.capacity - a.capacity || a.name.localeCompare(b.name, "uz", { numeric: true })),
    [rooms, time, days.length, day, startDate, endDate, others, today],
  );
  const freeRooms = roomCards.filter((r) => !r.busy);
  const fits = freeRooms.filter((r) => r.capacity >= cap);
  // O'qituvchi bandligi: xona qoidasi o'qituvchi nomi bilan.
  const teacherOf = (who: string) =>
    who && time && days.length
      ? findRoomConflict({ room: who, day, time, startDate, endDate }, others.map((g) => ({ ...g, room: g.teacher })), today) ??
        findRoomConflict({ room: who, day, time, startDate, endDate }, others.map((g) => ({ ...g, room: g.assistant ?? "" })), today)
      : null;
  const teacherClash = teacherOf(teacher);
  const teacherBusy = useMemo(() => {
    if (!teacher) return "";
    const mine = others.filter((g) => g.teacher === teacher && ["gathering", "active", "frozen"].includes(g.status));
    return mine.map((g) => `${g.day.toLowerCase()} ${g.time.replace(/\s*-\s*/, "–")}`).slice(0, 3).join(" · ");
  }, [others, teacher]);
  const selectedRoom = roomCards.find((r) => r.name === room) ?? null;

  const missing = missingGroupFields({ name, status, course, day, time, teacher, eduType, room });
  const blocker =
    missing.length > 0
      ? t("To'ldiring: {list}", { list: missing.map((m) => t(m)).join(", ") })
      : !endTime
        ? t("Dars yarim tundan oshib ketmasin")
        : selectedRoom?.busy
          ? t("{room}-xona bu vaqtda band — «{group}»", { room, group: selectedRoom.busy.name })
          : teacherClash
            ? t("{who} bu vaqtda «{group}» guruhida", { who: teacher, group: teacherClash.name })
            : null;

  async function save(close: () => void) {
    if (blocker) {
      showError(blocker);
      return;
    }
    const body: Record<string, unknown> = {
      name: name.trim(),
      status,
      course,
      level,
      day,
      time,
      teacher,
      assistant,
      eduType,
      room,
      telegram: telegram.trim(),
      startDate,
      endDate,
      capacity: cap > 0 ? cap : null,
    };
    if (editing) {
      const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
      body.period = startDate || endDate ? `${dmy(startDate)} - ${dmy(endDate)}` : "";
    }
    setSaving(true);
    const res = await fetch(editing ? `/api/groups/${group.id}` : "/api/groups", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      showError(t(res?.error || (editing ? "Saqlanmadi" : "Guruh qo'shilmadi")));
      return;
    }
    const saved = res.group as Group;
    onSaved?.(saved);
    showSuccess(editing ? t("Guruh yangilandi") : t("Guruh qo'shildi — {trimmed}", { trimmed: saved.name }));
    close();
    if (!editing && thenAdd) router.push(`/groups/${saved.id}?tab=oquvchilar`);
  }

  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const chip = (on: boolean) =>
    `inline-flex h-8 items-center gap-1.5 rounded-v2-full border px-3 text-v2-small font-medium transition-colors ${on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"}`;

  return (
    <V2Dialog
      variant="right"
      width={560}
      title={editing ? t("Guruhni tahrirlash") : t("Yangi guruh")}
      subtitle={editing ? group.name : t("{branch} filiali", { branch: branchName })}
      onClose={onClose}
      saving={saving}
      dirty={!editing ? Boolean(name || course || teacher) : name !== group.name}
      footerStart={
        !editing ? (
          <span className="inline-flex items-center gap-2 text-v2-small text-v2-text-2">
            <V2Checkbox checked={thenAdd} onChange={setThenAdd} label={t("Keyin o'quvchi qo'shish")} />
            {t("Keyin o'quvchi qo'shish")}
          </span>
        ) : undefined
      }
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} title={blocker ?? undefined} className={`${primaryBtn} disabled:opacity-50`}>
            <Check className="size-4" strokeWidth={2} aria-hidden />
            {t("Guruhni saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="text-v2-caption text-v2-text-3">{t("Guruh")}</div>
          <Field label={t("Guruh nomi")} htmlFor="gf-name">
            <TextInput id="gf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Masalan: Ingliz tili · 1-bosqich (kechki)")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Kurs")}>
              <V2Select
                label={t("Kurs")}
                placeholder={t("Tanlang")}
                value={course}
                onChange={(v) => {
                  setCourse(v);
                  setLevel("");
                }}
                options={[...new Set([...(course && !activeNames.includes(course) ? [course] : []), ...activeNames])].map((c) => ({ value: c, label: c }))}
              />
            </Field>
            <Field label={t("Daraja")} optional>
              <V2Select label={t("Daraja")} placeholder={levels.length ? t("Tanlang") : t("Darajasi yo'q")} value={level} onChange={setLevel} options={levels.map((l) => ({ value: l, label: l }))} searchable={false} />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <Field label={t("Oylik narx")} hint={t("Sozlamalar → Kurslar'dagi narx")}>
              <div className={`${fieldCls("default")} flex items-center gap-2 bg-v2-surface-2!`}>
                {course && <span className={`size-2 rounded-full ${FAN_DOT[fanOf(course)]}`} aria-hidden />}
                <b className="font-semibold tabular-nums text-v2-text">{price ? `${fmt(price)} ${t("so'm")}` : "—"}</b>
                {level && price ? <span className="text-v2-text-3">· {level}</span> : null}
              </div>
            </Field>
            <Field label={t("Sig'im")} htmlFor="gf-cap">
              <div className="relative">
                <TextInput id="gf-cap" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 3))} className="pr-12" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-v2-small text-v2-text-3">{t("o'rin")}</span>
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Guruh holati")}>
              <Segmented
                label={t("Guruh holati")}
                value={status}
                onChange={setStatus}
                options={[
                  { value: "gathering", label: t("Yig'ilmoqda") },
                  { value: "active", label: t("Aktiv") },
                  ...(editing ? [{ value: "frozen", label: t("Muzlatilgan") }] : []),
                ]}
              />
            </Field>
            <Field label={t("Ta'lim turi")}>
              <Segmented label={t("Ta'lim turi")} value={eduType} onChange={setEduType} options={[{ value: "Oflayn", label: t("Oflayn") }, { value: "Onlayn", label: t("Onlayn") }]} />
            </Field>
          </div>
        </section>

        <section className="space-y-3 border-t border-v2-border pt-4">
          <div className="text-v2-caption text-v2-text-3">{t("Dars jadvali")}</div>
          <Field label={<>{t("Dars kunlari")}{dayAbbr && <span className="font-normal text-v2-text-3"> · {dayAbbr}</span>}</>}>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p} type="button" aria-pressed={!customDays && day === p} onClick={() => { setCustomDays(false); setDay(p); }} className={chip(!customDays && day === p)}>
                  {!customDays && day === p && <Check className="size-3.5" strokeWidth={2.25} aria-hidden />}
                  {t(p)}
                </button>
              ))}
              <button type="button" aria-pressed={customDays} onClick={() => setCustomDays(true)} className={chip(customDays)}>
                {t("Boshqa kunlar")}
              </button>
            </div>
            {customDays && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {GROUP_WEEK.map((d) => {
                  const on = days.includes(d.wd);
                  return (
                    <button
                      key={d.wd}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDay(groupDayValue(on ? days.filter((x) => x !== d.wd) : [...days, d.wd]))}
                      className={`h-8 min-w-10 rounded-v2-md border px-2 text-v2-small font-medium ${on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text-2"}`}
                    >
                      {t(d.abbr)}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("Boshlanish sanasi")} htmlFor="gf-sd">
              <IsoDateField id="gf-sd" value={startDate} onChange={setStartDate} />
            </Field>
            <Field label={t("Boshlanish vaqti")} htmlFor="gf-st">
              <V2TimeField id="gf-st" value={startTime} onChange={setStartTime} />
            </Field>
            <Field label={t("Davomiyligi")}>
              <V2Select
                label={t("Davomiyligi")}
                value={String(duration)}
                onChange={(v) => v && setDuration(Number(v))}
                searchable={false}
                clearable={false}
                options={DURATIONS.map((m) => ({ value: String(m), label: m % 60 ? t("{h} soat {m} daq", { h: Math.floor(m / 60), m: m % 60 }) : t("{n} soat", { n: m / 60 }) }))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t("O'qituvchi")}
              error={teacherClash ? t("Bu vaqtda «{g}» guruhida", { g: teacherClash.name }) : undefined}
              hint={!teacherClash && teacherBusy ? t("{busy} band", { busy: teacherBusy }) : undefined}
            >
              <V2Select label={t("O'qituvchi")} placeholder={t("Tanlang")} value={teacher} onChange={setTeacher} options={[...new Set([...(teacher ? [teacher] : []), ...teacherNames])].map((n) => ({ value: n, label: n }))} />
            </Field>
            <Field label={t("Yordamchi")} optional>
              <V2Select label={t("Yordamchi")} placeholder={t("Tanlang")} value={assistant} onChange={setAssistant} options={teacherNames.filter((n) => n !== teacher).map((n) => ({ value: n, label: n }))} />
            </Field>
          </div>
          <Field label={<>{t("Xona")}{time && dayAbbr ? <span className="font-normal text-v2-text-3"> · {t("{days} {time} da bo'shlari", { days: day.toLowerCase(), time: time.replace(/\s*-\s*/, "–") })}</span> : null}</>}>
            {roomCards.length === 0 ? (
              <p className="text-v2-small text-v2-text-3">{t("Xonalar kiritilmagan — Guruh → Xonalar.")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {roomCards.map((r) => {
                  const on = room === r.name;
                  const short = cap > 0 && r.capacity > 0 && r.capacity < cap;
                  return (
                    <button
                      key={r.name}
                      type="button"
                      disabled={Boolean(r.busy)}
                      aria-pressed={on}
                      title={r.busy ? t("Band — «{g}» ({d}, {tm})", { g: r.busy.name, d: r.busy.day, tm: r.busy.time }) : undefined}
                      onClick={() => setRoom(r.name)}
                      className={`relative rounded-v2-md border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${on ? "border-v2-brand bg-v2-brand-bg shadow-v2-focus" : "border-v2-border-strong bg-v2-surface hover:bg-v2-surface-2"}`}
                    >
                      {on && <Check className="absolute right-2 top-2 size-4 text-v2-brand-text" strokeWidth={2.25} aria-hidden />}
                      <b className={`block text-v2-section ${on ? "text-v2-brand-text" : "text-v2-text"}`}>{r.name}</b>
                      <span className={`block text-v2-caption ${r.busy ? "text-v2-text-3" : short ? "text-v2-warning" : on ? "text-v2-brand-text" : "text-v2-text-2"}`}>
                        {r.busy ? t("band") : r.capacity ? t("{n} o'rin", { n: r.capacity }) : t("sig'im ?")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {cap > 0 && freeRooms.length > 0 && (
              <p className="mt-1.5 text-v2-small text-v2-text-3">
                {fits.length === 0
                  ? t("Sig'im {n} ga bo'sh xonalardan birortasi yetmaydi.", { n: cap })
                  : fits.length < freeRooms.length
                    ? t("Sig'im {n} ga faqat {list} yetadi — boshqalarida joy kam.", { n: cap, list: fits.map((r) => `${r.name}-xona`).join(", ") })
                    : t("Bo'sh xonalarning hammasiga sig'adi.")}
              </p>
            )}
          </Field>
          {teacher && room && time && !blocker && (
            <div className="flex flex-wrap items-center gap-2 rounded-v2-md bg-v2-success-bg px-3 py-2 text-v2-small">
              <CheckCircle2 className="size-4 text-v2-success" strokeWidth={1.75} aria-hidden />
              <b className="font-semibold text-v2-text">{t("O'qituvchi va xona {time} da bo'sh", { time: time.replace(/\s*-\s*/, "–") })}</b>
              <Link href="/groups-schedule" className="ml-auto font-semibold text-v2-success hover:underline">{t("Jadvalda ko'rish")}</Link>
            </div>
          )}
          {blocker && (teacher || room) && (
            <div className="flex items-center gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-small text-v2-text">
              <TriangleAlert className="size-4 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
              {blocker}
            </div>
          )}
        </section>

        <section className="rounded-v2-md border border-dashed border-v2-border-strong">
          <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-v2-small">
            <span className="text-v2-text-2">+</span>
            <b className="font-semibold text-v2-text">{t("Qo'shimcha")}</b>
            <span className="text-v2-text-3">· {t("Telegram havola, tugash sanasi")}</span>
            <ChevronDown className={`ml-auto size-4 text-v2-text-2 transition-transform ${moreOpen ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
          </button>
          {moreOpen && (
            <div className="grid grid-cols-2 gap-3 border-t border-v2-border px-3 py-3">
              <Field label={t("Telegram havola")} optional htmlFor="gf-tg">
                <TextInput id="gf-tg" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/…" />
              </Field>
              <Field label={t("Tugash sanasi")} optional htmlFor="gf-ed">
                <IsoDateField id="gf-ed" value={endDate} onChange={setEndDate} />
              </Field>
            </div>
          )}
        </section>
      </div>
    </V2Dialog>
  );
}
