"use client";

import { useState } from "react";
import { Archive, CircleCheck, Snowflake, TriangleAlert, UserPlus } from "lucide-react";
import Modal, { useModal } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Segmented from "@/components/ui/Segmented";
import DateField from "@/components/ui/DateField";
import TimeField from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toast";
import { useGroups } from "@/hooks/useGroups";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useRooms } from "@/hooks/useRooms";
import { useTeachers } from "@/hooks/useTeachers";
import { GROUP_DAYS, GROUP_FORMATS } from "@/constants/groups";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import { findRoomConflict, joinTime, missingGroupFields, parseTimeRange, roomConflictText } from "@/lib/groupRules";
import { courseLevelNames, findCourseByName, levelPlaceholder } from "@/lib/courseLevels";
import { uzDateIso } from "@/lib/uzTime";
import type { Group } from "@/lib/groups";
import { useT } from "@/components/shared/Language";

// Guruh QO'SHISH va TAHRIRLASH — bitta modal. `group` berilsa tahrirlash
// (PATCH /api/groups/:id), bo'lmasa qo'shish (POST /api/groups).
//
// NEGA BITTA: 14.09.2026 gacha ikkita alohida modal edi — AddGroupModal
// (ikki ustun, holat va ta'lim turi segment tugmalar, vaqt juft maydon)
// va EditGroupModal (bir ustun, hamma narsa select). Bir xil forma ikki
// xil ko'rinishda turardi; foydalanuvchi "qo'shishda qanday modal
// bo'lsa, tahrirlashda ham shunday bo'lsin" dedi. Endi maydonlar,
// joylashuv, majburiylik qoidasi va xona bandligi tekshiruvi ikkala
// rejimda AYNAN bir xil; farq faqat sarlavha, boshlang'ich qiymatlar,
// so'rov turi va toast matnida.
//
// Kurslar, o'qituvchilar va xonalar bazadan (/api/offline-courses,
// /api/teachers, /api/rooms). Daraja (bosqich) ro'yxati TANLANGAN KURSNING
// o'zidan (kurs hujjatidagi `levels`) — lib/courseLevels.ts.
//
// MAJBURIY MAYDONLAR — qoida lib/groupRules.ts da (server POST/PATCH ham
// AYNAN shuni tekshiradi): majburiy maydon bo'sh yoki xona band bo'lsa
// "Saqlash" o'chiq turadi va yonida nima yetishmayotgani yoziladi.
//
// Xona bandligi ro'yxatdagi guruhlar bo'yicha JOYIDA ko'rsatiladi:
// Guruhlar sahifasi o'z ro'yxatini `groups` orqali beradi (qo'shimcha
// so'rov yo'q), guruh sahifasi bermaydi — u holda /api/groups dan olinadi
// (useGroups). Tahrirlashda guruhning o'zi hisobga kirmaydi (`excludeId`).
// Server 409 bilan oxirgi so'zni aytadi (ikki moderator bir vaqtda).
//
// "Guruh holati" va "Ta'lim turi" — segment tugmalar: variant 2–4 ta,
// deyarli doim "Aktiv guruh" tanlanadi, shuning uchun standart qiymat
// oldindan turadi va moderator hech narsa bosmasa ham to'g'ri chiqadi.
//
// Holatlar tartibi va ma'nosi — lib/groupRules.ts (GROUP_STATUS_VALUES):
// "Yig'ilayotgan" (18.09.2026) — o'quvchilar yig'ilayotgan, dars hali
// boshlanmagan guruh; xonani band qiladi, davomat kutilmaydi.

const STATUS_OPTIONS = [
  { value: "gathering", label: "Yig'ilayotgan", icon: UserPlus },
  { value: "active", label: "Aktiv guruh", icon: CircleCheck },
  { value: "frozen", label: "Muzlatilgan", icon: Snowflake },
  { value: "archive", label: "Arxiv", icon: Archive },
];
const FORMAT_OPTIONS = GROUP_FORMATS.map((f) => ({ value: f, label: f }));
const DAY_OPTIONS = GROUP_DAYS.map((d) => ({ value: d, label: d }));

const inputCls = "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

/**
 * Guruhda saqlangan qiymat bazadagi ro'yxatda bo'lmasligi mumkin (eski
 * yozuvlar, o'chirilgan xona/o'qituvchi). Uni ro'yxat boshiga qo'shamiz —
 * aks holda select bo'sh ko'rinib, saqlashda qiymat jimgina yo'qolardi.
 * Qo'shish rejimida joriy qiymat bo'sh — ro'yxat o'zgarmaydi.
 */
function withCurrent(list: string[], current: string): string[] {
  return current && !list.includes(current) ? [current, ...list] : list;
}
// "16.09.2026" ↔ "2026-09-16": `period` satri eski guruhlarda yagona manba.
function dmyToIso(s: string): string {
  const m = s.trim().match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
function isoToDmy(s: string): string {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/**
 * Footer — modal konteksti ichida, yopish animatsiya bilan. `blocker` —
 * nega saqlab bo'lmasligi (bo'sh maydonlar / vaqt / xona); bor ekan tugma
 * o'chiq va sabab chap tomonda yozib turadi — jim o'chiq tugma moderatorni
 * "nima qildim?" deb qoldirmasin.
 */
function Actions({ saving, blocker, onSave }: { saving: boolean; blocker: string | null; onSave: (close: () => void) => void }) {
  const { t } = useT();
  const { close } = useModal();
  return (
    <>
      {blocker && (
        <span className="mr-auto inline-flex items-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-400 leading-tight">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
          <span>{blocker}</span>
        </span>
      )}
      <button
        type="button"
        onClick={close}
        disabled={saving}
        className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
      >
        {t("Orqaga")}
      </button>
      <button
        type="button"
        onClick={() => onSave(close)}
        disabled={saving || blocker !== null}
        title={blocker ?? undefined}
        className="inline-flex items-center h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? t("Saqlanmoqda…") : t("Saqlash")}
      </button>
    </>
  );
}

export default function GroupFormModal({
  group,
  groups: groupsProp,
  onClose,
  onSaved,
}: {
  /** Tahrirlanayotgan guruh; berilmasa — yangi guruh qo'shish. */
  group?: Group;
  /** Sahifadagi guruhlar — xona bandligini joyida ko'rsatish uchun; bo'lmasa /api/groups. */
  groups?: Group[];
  onClose: () => void;
  /** Qo'shilgan yoki yangilangan guruh (serverdan qaytgan hujjat). */
  onSaved?: (g: Group) => void;
}) {
  const { t } = useT();
  const editing = group !== undefined;
  const { showSuccess, showError } = useToast();
  const { courses, names: courseNames, loading: coursesLoading } = useOfflineCourseList();
  const { names: teacherNames, loading: teachersLoading } = useTeachers();
  const { names: roomNames, loading: roomsLoading } = useRooms();
  // `groupsProp` berilsa so'rov yuborilmaydi — u boshlang'ich ro'yxat bo'lib kiradi.
  const { groups } = useGroups(groupsProp);

  const [t0, t1] = (group?.time || " - ").split(" - ");
  const [p0, p1] = (group?.period || " - ").split(" - ");

  const [name, setName] = useState(group?.name ?? "");
  const [status, setStatus] = useState(group?.status || "active");
  const [course, setCourse] = useState(group?.course ?? "");
  const [level, setLevel] = useState(group?.level ?? "");
  const [day, setDay] = useState(group?.day ?? "");
  const [startTime, setStartTime] = useState(t0?.trim() ?? "");
  const [endTime, setEndTime] = useState(t1?.trim() ?? "");
  const [teacher, setTeacher] = useState(group?.teacher ?? "");
  const [assistant, setAssistant] = useState(group?.assistant ?? "");
  const [eduType, setEduType] = useState(group?.eduType || GROUP_FORMATS[0]);
  const [room, setRoom] = useState(group?.room ?? "");
  const [telegram, setTelegram] = useState(group?.telegram ?? "");
  const [startDate, setStartDate] = useState(group?.startDate || dmyToIso(p0 ?? ""));
  const [endDate, setEndDate] = useState(group?.endDate || dmyToIso(p1 ?? ""));
  const [saving, setSaving] = useState(false);

  // Bosqichlar — tanlangan kursniki. Kurs almashsa eski bosqich unda
  // bo'lmasligi mumkin — `onChange` da tozalanadi. Guruhda arxivdan qolgan
  // "1-bosqich" kabi ro'yxatda yo'q qiymat bo'lsa, `withCurrent` uni saqlab
  // turadi — server ham o'zgarmagan bosqichni tekshirmaydi.
  const levelNames = courseLevelNames(findCourseByName(courses, course));

  const time = joinTime(startTime, endTime);
  const missing = missingGroupFields({ name, status, course, day, time, teacher, eduType, room });
  // Ikkala vaqt tanlangan, lekin tartib noto'g'ri — bu bo'sh maydon emas, xato.
  const timeOrderError = Boolean(startTime && endTime) && parseTimeRange(time) === null;
  // Xona bandligi — maydonlar to'liq bo'lgach, ro'yxat bo'yicha.
  // useMemo yo'q — ro'yxat kichik (yuzlab guruh), React Compiler o'zi keshlaydi.
  const conflict = room && day && time
    ? findRoomConflict({ room, day, time, startDate, endDate }, groups, uzDateIso(), group?.id)
    : null;
  const conflictText = conflict ? roomConflictText(room, conflict) : null;

  const blocker = missing.length > 0
    ? `To'ldiring: ${missing.join(", ")}`
    : timeOrderError
      ? "Tugash vaqti boshlanishdan keyin bo'lishi kerak"
      : conflictText;

  async function save(close: () => void) {
    if (blocker) return;
    const trimmed = name.trim();
    const body: Record<string, unknown> = {
      name: trimmed,
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
    };
    // POST `period`ni o'zi tuzadi; PATCH kelgan maydonlarni shunchaki
    // yozadi, shu bois sanalar bilan birga ko'rinadigan satr ham yuboriladi
    // (ro'yxatdagi "Guruh vaqti" ustuni). Ikkala sana ham o'chirilsa — bo'sh.
    if (editing) body.period = startDate || endDate ? `${isoToDmy(startDate)} - ${isoToDmy(endDate)}` : "";
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/groups/${group.id}` : "/api/groups", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || (editing ? t("Saqlanmadi") : t("Guruh qo'shilmadi")));
        setSaving(false);
        return;
      }
      onSaved?.(data.group as Group);
      showSuccess(editing ? "Guruh yangilandi" : t("Guruh qo'shildi — {trimmed}", { trimmed }));
      close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={editing ? t("Guruhni tahrirlash") : t("Yangi guruh qo'shish")}
      subtitle={<><span className="text-red-500">*</span>{" "}{t("Zarurligini bildiradi")}</>}
      size="xl"
      locked={saving}
      footer={<Actions saving={saving} blocker={blocker} onSave={save} />}
    >
      {/* Nom va holat — to'liq kenglikda: to'rtta segment (Yig'ilayotgan /
          Aktiv / Muzlatilgan / Arxiv) yarim ustunga sig'maydi, qolgan
          maydonlar juft-juft. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
        <div className="sm:col-span-2">
          <label className={labelCls}>{t("Guruh nomi")}<span className="text-red-500">*</span></label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            autoFocus={!editing}
            placeholder={t("Masalan: 12")}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t("Guruh holati")}<span className="text-red-500">*</span></label>
          <Segmented value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>

        <Select
          label={t("Kurs")}
          required
          value={course}
          onChange={(v) => {
            setCourse(v);
            if (level && !courseLevelNames(findCourseByName(courses, v)).includes(level)) setLevel("");
          }}
          options={withCurrent(courseNames, course).map((c) => ({ value: c, label: c }))}
          loading={coursesLoading}
          placeholder={t("Kursni tanlang")}
          searchPlaceholder="Kursni qidirish"
          emptyText={t("Kurslar ro'yxati bo'sh — avval Oflayn kurslar bo'limida kurs oching")}
        />
        <Select
          label={t("Daraja (bosqich)")}
          value={level}
          onChange={setLevel}
          options={withCurrent(levelNames, level).map((l) => ({ value: l, label: l }))}
          placeholder={levelPlaceholder(Boolean(course), levelNames.length)}
          disabled={!course || (levelNames.length === 0 && !level)}
          emptyText={t("Bu kursda bosqich yo'q — Oflayn kurslar → kurs sahifasida qo'shing")}
          clearable
        />

        <Select
          label={t("Dars kunlari")}
          required
          value={day}
          onChange={setDay}
          options={DAY_OPTIONS}
          placeholder={t("Tanlang")}
        />
        <div>
          <label className={labelCls}>{t("Dars vaqti")}<span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            <TimeField value={startTime} onChange={setStartTime} variant="form" placeholder={t("Boshlanish")} error={timeOrderError} />
            <TimeField value={endTime} onChange={setEndTime} variant="form" placeholder={t("Tugash")} error={timeOrderError} />
          </div>
        </div>

        <Select
          label={t("O'qituvchi")}
          required
          value={teacher}
          onChange={setTeacher}
          options={withCurrent(teacherNames, teacher).map((tv) => ({ value: tv, label: tv }))}
          loading={teachersLoading}
          placeholder={selectPlaceholder(teachersLoading, teacherNames.length, "O'qituvchi qo'shilmagan")}
          searchPlaceholder="O'qituvchini qidirish"
          emptyText={t("O'qituvchilar ro'yxati bo'sh — Boshqaruv → Xodimlar bo'limida o'qituvchi qo'shing")}
        />
        <Select
          label={t("Yordamchi o'qituvchi")}
          value={assistant}
          onChange={setAssistant}
          options={withCurrent(teacherNames, assistant).map((tv) => ({ value: tv, label: tv }))}
          loading={teachersLoading}
          placeholder={selectPlaceholder(teachersLoading, teacherNames.length, "O'qituvchi qo'shilmagan")}
          searchPlaceholder="O'qituvchini qidirish"
          emptyText={t("O'qituvchilar ro'yxati bo'sh")}
          clearable
        />

        <div>
          <Select
            label={t("Xona")}
            required
            value={room}
            onChange={setRoom}
            options={withCurrent(roomNames, room).map((r) => ({ value: r, label: r }))}
            loading={roomsLoading}
            placeholder={selectPlaceholder(roomsLoading, roomNames.length, "Xona qo'shilmagan")}
            searchPlaceholder="Xonani qidirish"
            emptyText={t("Xonalar ro'yxati bo'sh — Guruh → Xonalar bo'limida xona qo'shing")}
            error={conflict !== null}
          />
          {conflictText && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-red-600 dark:text-red-400 leading-snug">
              <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{conflictText}</span>
            </p>
          )}
        </div>
        <div>
          <label className={labelCls}>{t("Ta'lim turi")}<span className="text-red-500">*</span></label>
          <Segmented value={eduType} onChange={setEduType} options={FORMAT_OPTIONS} />
        </div>

        <div>
          <label className={labelCls}>{t("Boshlanish sanasi")}</label>
          <DateField value={startDate} onChange={setStartDate} variant="form" placeholder="kk/oo/yyyy" />
        </div>
        <div>
          <label className={labelCls}>{t("Bitkazish sanasi")}</label>
          <DateField value={endDate} onChange={setEndDate} variant="form" placeholder="kk/oo/yyyy" />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>{t("Telegram guruh havolasi")}</label>
          <input value={telegram} onChange={(e) => setTelegram(e.target.value)} type="text" placeholder="https://t.me/..." className={inputCls} />
        </div>
      </div>
    </Modal>
  );
}
