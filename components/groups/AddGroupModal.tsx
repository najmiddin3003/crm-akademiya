"use client";

import { useState } from "react";
import { Archive, CircleCheck, Snowflake, TriangleAlert } from "lucide-react";
import Modal, { useModal } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Segmented from "@/components/ui/Segmented";
import DateField from "@/components/ui/DateField";
import TimeField from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toast";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useRooms } from "@/hooks/useRooms";
import { useTeachers } from "@/hooks/useTeachers";
import { GROUP_DAYS, GROUP_FORMATS } from "@/constants/groups";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import { findRoomConflict, joinTime, missingGroupFields, parseTimeRange, roomConflictText } from "@/lib/groupRules";
import { courseLevelNames, findCourseByName, levelPlaceholder } from "@/lib/courseLevels";
import { uzDateIso } from "@/lib/uzTime";
import type { Group } from "@/lib/groups";

// Yangi guruh qo'shish modali (crm-akademiya #group-add-modal, skrinshot 2).
// Saqlash → POST /api/groups.
//
// Kurslar, o'qituvchilar va xonalar bazadan (/api/offline-courses,
// /api/teachers, /api/rooms) — tahrirlash modali bilan bir xil manba.
// Daraja (bosqich) ro'yxati TANLANGAN KURSNING o'zidan (kurs hujjatidagi
// `levels`, Oflayn kurslar → kurs → "Bosqich qo'shish") — lib/courseLevels.ts.
//
// MAJBURIY MAYDONLAR (11.09.2026, audit F-1/F-2): ilgari oynada yulduzcha
// turgan maydonlar ham aslida tekshirilmasdi (faqat nom), o'qituvchi,
// xona, dars kunlari, vaqti va daraja esa umuman yo'q edi — guruh
// yaratilgach darhol "Tahrirlash"ga kirishga to'g'ri kelardi. Endi qoida
// lib/groupRules.ts da (server ham AYNAN shuni tekshiradi): majburiy
// maydon bo'sh yoki xona band bo'lsa "Saqlash" o'chiq turadi va yonida
// nima yetishmayotgani yoziladi.
//
// Xona bandligi ro'yxatdagi guruhlar bo'yicha JOYIDA ko'rsatiladi
// (`groups` — sahifa allaqachon yuklab qo'ygan, qo'shimcha so'rov yo'q);
// server 409 bilan oxirgi so'zni aytadi (ikki moderator bir vaqtda).
//
// "Guruh holati" va "Ta'lim turi" — segment tugmalar: variant 2–3 ta,
// deyarli doim birinchisi tanlanadi, shuning uchun standart qiymat
// oldindan turadi va moderator hech narsa bosmasa ham to'g'ri chiqadi.

const STATUS_OPTIONS = [
  { value: "active", label: "Aktiv guruh", icon: CircleCheck },
  { value: "frozen", label: "Muzlatilgan", icon: Snowflake },
  { value: "archive", label: "Arxiv", icon: Archive },
];
const FORMAT_OPTIONS = GROUP_FORMATS.map((f) => ({ value: f, label: f }));
const DAY_OPTIONS = GROUP_DAYS.map((d) => ({ value: d, label: d }));

const inputCls = "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

/**
 * Footer — modal konteksti ichida, yopish animatsiya bilan. `blocker` —
 * nega saqlab bo'lmasligi (bo'sh maydonlar / vaqt / xona); bor ekan tugma
 * o'chiq va sabab chap tomonda yozib turadi — jim o'chiq tugma moderatorni
 * "nima qildim?" deb qoldirmasin.
 */
function Actions({ saving, blocker, onSave }: { saving: boolean; blocker: string | null; onSave: (close: () => void) => void }) {
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
        Orqaga
      </button>
      <button
        type="button"
        onClick={() => onSave(close)}
        disabled={saving || blocker !== null}
        title={blocker ?? undefined}
        className="inline-flex items-center h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? "Saqlanmoqda…" : "Saqlash"}
      </button>
    </>
  );
}

export default function AddGroupModal({
  groups = [],
  onClose,
  onCreated,
}: {
  /** Sahifadagi guruhlar — xona bandligini joyida ko'rsatish uchun. */
  groups?: Group[];
  onClose: () => void;
  onCreated?: (g: Group) => void;
}) {
  const { showSuccess, showError } = useToast();
  const { courses, names: courseNames, loading: coursesLoading } = useOfflineCourseList();
  const { names: teacherNames, loading: teachersLoading } = useTeachers();
  const { names: roomNames, loading: roomsLoading } = useRooms();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [course, setCourse] = useState("");
  const [level, setLevel] = useState("");
  const [day, setDay] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [teacher, setTeacher] = useState("");
  const [eduType, setEduType] = useState(GROUP_FORMATS[0]);
  const [room, setRoom] = useState("");
  const [telegram, setTelegram] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Bosqichlar — tanlangan kursniki. Kurs almashsa eski bosqich unda
  // bo'lmasligi mumkin — `onChange` da tozalanadi.
  const levelNames = courseLevelNames(findCourseByName(courses, course));

  const time = joinTime(startTime, endTime);
  const missing = missingGroupFields({ name, status, course, day, time, teacher, eduType, room });
  // Ikkala vaqt tanlangan, lekin tartib noto'g'ri — bu bo'sh maydon emas, xato.
  const timeOrderError = Boolean(startTime && endTime) && parseTimeRange(time) === null;
  // Xona bandligi — maydonlar to'liq bo'lgach, sahifadagi ro'yxat bo'yicha.
  // useMemo yo'q — ro'yxat kichik (yuzlab guruh), React Compiler o'zi keshlaydi.
  const conflict = room && day && time ? findRoomConflict({ room, day, time, startDate, endDate }, groups, uzDateIso()) : null;
  const conflictText = conflict ? roomConflictText(room, conflict) : null;

  const blocker = missing.length > 0
    ? `To'ldiring: ${missing.join(", ")}`
    : timeOrderError
      ? "Tugash vaqti boshlanishdan keyin bo'lishi kerak"
      : conflictText;

  async function save(close: () => void) {
    if (blocker) return;
    setSaving(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          status,
          course,
          level,
          day,
          time,
          teacher,
          eduType,
          room,
          telegram: telegram.trim(),
          startDate,
          endDate,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Guruh qo'shilmadi");
        setSaving(false);
        return;
      }
      onCreated?.(data.group as Group);
      showSuccess(`Guruh qo'shildi — ${name.trim()}`);
      close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Yangi guruh qo'shish"
      subtitle={<><span className="text-red-500">*</span> Zarurligini bildiradi</>}
      size="xl"
      locked={saving}
      footer={<Actions saving={saving} blocker={blocker} onSave={save} />}
    >
      {/* Nom va holat — to'liq kenglikda: uchta segment (Aktiv / Muzlatilgan /
          Arxiv) yarim ustunga sig'maydi, qolgan maydonlar juft-juft. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
        <div className="sm:col-span-2">
          <label className={labelCls}>Guruh nomi<span className="text-red-500">*</span></label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            autoFocus
            placeholder="Masalan: 12"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Guruh holati<span className="text-red-500">*</span></label>
          <Segmented value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>

        <Select
          label="Kurs"
          required
          value={course}
          onChange={(v) => {
            setCourse(v);
            if (level && !courseLevelNames(findCourseByName(courses, v)).includes(level)) setLevel("");
          }}
          options={courseNames.map((c) => ({ value: c, label: c }))}
          loading={coursesLoading}
          placeholder="Kursni tanlang"
          searchPlaceholder="Kursni qidirish"
          emptyText="Kurslar ro'yxati bo'sh — avval Oflayn kurslar bo'limida kurs oching"
        />
        <Select
          label="Daraja (bosqich)"
          value={level}
          onChange={setLevel}
          options={levelNames.map((l) => ({ value: l, label: l }))}
          placeholder={levelPlaceholder(Boolean(course), levelNames.length)}
          disabled={!course || levelNames.length === 0}
          emptyText="Bu kursda bosqich yo'q — Oflayn kurslar → kurs sahifasida qo'shing"
          clearable
        />

        <Select
          label="Dars kunlari"
          required
          value={day}
          onChange={setDay}
          options={DAY_OPTIONS}
          placeholder="Tanlang"
        />
        <div>
          <label className={labelCls}>Dars vaqti<span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            <TimeField value={startTime} onChange={setStartTime} variant="form" placeholder="Boshlanish" error={timeOrderError} />
            <TimeField value={endTime} onChange={setEndTime} variant="form" placeholder="Tugash" error={timeOrderError} />
          </div>
        </div>

        <Select
          label="O'qituvchi"
          required
          value={teacher}
          onChange={setTeacher}
          options={teacherNames.map((t) => ({ value: t, label: t }))}
          loading={teachersLoading}
          placeholder={selectPlaceholder(teachersLoading, teacherNames.length, "O'qituvchi qo'shilmagan")}
          searchPlaceholder="O'qituvchini qidirish"
          emptyText="O'qituvchilar ro'yxati bo'sh — Boshqaruv → Xodimlar bo'limida o'qituvchi qo'shing"
        />
        <div>
          <Select
            label="Xona"
            required
            value={room}
            onChange={setRoom}
            options={roomNames.map((r) => ({ value: r, label: r }))}
            loading={roomsLoading}
            placeholder={selectPlaceholder(roomsLoading, roomNames.length, "Xona qo'shilmagan")}
            searchPlaceholder="Xonani qidirish"
            emptyText="Xonalar ro'yxati bo'sh — Guruh → Xonalar bo'limida xona qo'shing"
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
          <label className={labelCls}>Ta&apos;lim turi<span className="text-red-500">*</span></label>
          <Segmented value={eduType} onChange={setEduType} options={FORMAT_OPTIONS} />
        </div>
        <div>
          <label className={labelCls}>Telegram guruh havolasi</label>
          <input value={telegram} onChange={(e) => setTelegram(e.target.value)} type="text" placeholder="https://t.me/..." className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Boshlanish sanasi</label>
          <DateField value={startDate} onChange={setStartDate} variant="form" placeholder="kk/oo/yyyy" />
        </div>
        <div>
          <label className={labelCls}>Bitkazish sanasi</label>
          <DateField value={endDate} onChange={setEndDate} variant="form" placeholder="kk/oo/yyyy" />
        </div>
      </div>
    </Modal>
  );
}

