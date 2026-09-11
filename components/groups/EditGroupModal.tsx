"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useRooms } from "@/hooks/useRooms";
import { useTeachers } from "@/hooks/useTeachers";
import { GROUP_DAYS, GROUP_FORMATS } from "@/constants/groups";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import { joinTime, missingGroupFields, parseTimeRange } from "@/lib/groupRules";
import { courseLevelNames, findCourseByName, levelPlaceholder } from "@/lib/courseLevels";
import type { Group } from "@/lib/groups";
import Select from "@/components/ui/Select";
import TimeField from "@/components/ui/TimeField";
import DateField from "@/components/ui/DateField";
import Modal, { useModalClose } from "@/components/ui/Modal";

// Guruhni tahrirlash modali (skrinshot 1). Guruh maydonlari bilan to'ldirilgan;
// Saqlash → PATCH /api/groups/:id.
//
// Kurs, o'qituvchi va xona ro'yxatlari BAZADAN (/api/offline-courses,
// /api/teachers, /api/rooms) — ilgari constants'dagi qattiq ro'yxatlardan
// kelardi, ya'ni foydalanuvchi qo'shgan o'qituvchi yoki xonani bu yerda
// tanlab bo'lmasdi. Guruhning o'qituvchisi ISM bo'yicha oylik hisobiga
// ulanadi (lib/payrollSources.ts), shu bois ro'yxatdan tashqari ism
// tushum-taqsimotini ham buzardi.
//
// Majburiy maydonlar — qo'shish modali bilan bir xil qoida
// (lib/groupRules.ts; server PATCH da ham tekshiradi): bo'sh qolsa
// "Saqlash" o'chiq va yonida sabab yoziladi. Xona bandligini bu yerda
// ro'yxat yo'qligi uchun server 409 bilan aytadi (xabar toastda).
const inputCls = "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

/**
 * Guruhda saqlangan qiymat bazadagi ro'yxatda bo'lmasligi mumkin (eski
 * yozuvlar, o'chirilgan xona/o'qituvchi). Uni ro'yxat boshiga qo'shamiz —
 * aks holda select bo'sh ko'rinib, saqlashda qiymat jimgina yo'qolardi.
 */
function withCurrent(list: string[], current: string): string[] {
  return current && !list.includes(current) ? [current, ...list] : list;
}
function dmyToIso(s: string): string {
  const m = s.trim().match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
function isoToDmy(s: string): string {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

export default function EditGroupModal({ group, onClose, onSaved }: { group: Group; onClose: () => void; onSaved: (g: Group) => void }) {
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const { courses, names: courseNames, loading: coursesLoading } = useOfflineCourseList();
  const { names: teacherNames, loading: teachersLoading } = useTeachers();
  const { names: roomNames, loading: roomsLoading } = useRooms();

  const [t0, t1] = (group.time || " - ").split(" - ");
  const [p0, p1] = (group.period || " - ").split(" - ");

  const [name, setName] = useState(group.name);
  const [status, setStatus] = useState(group.status || "active");
  const [course, setCourse] = useState(group.course || "");
  const [level, setLevel] = useState(group.level || "");
  const [day, setDay] = useState(group.day || "");
  const [startTime, setStartTime] = useState(t0?.trim() || "");
  const [endTime, setEndTime] = useState(t1?.trim() || "");
  const [teacher, setTeacher] = useState(group.teacher || "");
  const [assistant, setAssistant] = useState(group.assistant || "");
  const [eduType, setEduType] = useState(group.eduType || "Oflayn");
  const [room, setRoom] = useState(group.room || "");
  const [telegram, setTelegram] = useState(group.telegram || "");
  const [startDate, setStartDate] = useState(group.startDate || dmyToIso(p0 || ""));
  const [endDate, setEndDate] = useState(group.endDate || dmyToIso(p1 || ""));
  const [saving, setSaving] = useState(false);

  // Bosqichlar — tanlangan kursniki (lib/courseLevels.ts). Guruhda arxivdan
  // qolgan "1-bosqich" kabi ro'yxatda yo'q qiymat bo'lsa, `withCurrent`
  // uni saqlab turadi — server ham o'zgarmagan bosqichni tekshirmaydi.
  const levelNames = courseLevelNames(findCourseByName(courses, course));

  const time = joinTime(startTime, endTime);
  const missing = missingGroupFields({ name, status, course, day, time, teacher, eduType, room });
  const timeOrderError = Boolean(startTime && endTime) && parseTimeRange(time) === null;
  const blocker = missing.length > 0
    ? `To'ldiring: ${missing.join(", ")}`
    : timeOrderError
      ? "Tugash vaqti boshlanishdan keyin bo'lishi kerak"
      : null;

  async function save() {
    if (blocker) return;
    const trimmed = name.trim();
    const period = startDate || endDate ? `${isoToDmy(startDate)} - ${isoToDmy(endDate)}` : group.period;
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, status, course, level, day, time, teacher, assistant, eduType, room, telegram: telegram.trim(), startDate, endDate, period }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.group as Group);
      showSuccess("Guruh yangilandi");
      modal.close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare>
        <div className="px-6 pt-5 pb-2 flex-shrink-0">
          <h3 className="text-base font-semibold">Guruhni tahrirlash</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5"><span className="text-rose-500">*</span> Zarurligini bildiradi</p>
        </div>

        <div className="px-6 py-2 space-y-3.5 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Guruh nomi<span className="text-rose-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Guruh holati<span className="text-rose-500">*</span></label>
            <Select value={status} onChange={(v) => setStatus(v)} options={[{ value: "active", label: "Aktiv" }, { value: "frozen", label: "Muzlatilgan" }, { value: "archive", label: "Arxiv" }]} />
          </div>
          <div>
            <label className={labelCls}>Kurs<span className="text-rose-500">*</span></label>
            <Select value={course} onChange={(v) => { setCourse(v); if (level && !courseLevelNames(findCourseByName(courses, v)).includes(level)) setLevel(""); }} options={withCurrent(courseNames, course).map((c) => ({ value: c, label: c }))} placeholder={selectPlaceholder(coursesLoading, courseNames.length, "Kurs qo'shilmagan")} clearable disabled={coursesLoading} />
          </div>
          <div>
            <label className={labelCls}>Kurs darajasi</label>
            <Select value={level} onChange={(v) => setLevel(v)} options={withCurrent(levelNames, level).map((l) => ({ value: l, label: l }))} placeholder={levelPlaceholder(Boolean(course), levelNames.length)} disabled={!course || (levelNames.length === 0 && !level)} clearable />
          </div>
          <div>
            <label className={labelCls}>Dars kunini tanlang<span className="text-rose-500">*</span></label>
            <Select value={day} onChange={(v) => setDay(v)} options={GROUP_DAYS.map((d) => ({ value: d, label: d }))} placeholder="Tanlang" clearable />
          </div>
          <div>
            <label className={labelCls}>Boshlanish vaqti<span className="text-rose-500">*</span></label>
            <TimeField value={startTime} onChange={setStartTime} variant="form" error={timeOrderError} />
          </div>
          <div>
            <label className={labelCls}>Tugash vaqti<span className="text-rose-500">*</span></label>
            <TimeField value={endTime} onChange={setEndTime} variant="form" error={timeOrderError} />
          </div>
          <div>
            <label className={labelCls}>O&apos;qituvchi<span className="text-rose-500">*</span></label>
            <Select value={teacher} onChange={(v) => setTeacher(v)} options={withCurrent(teacherNames, teacher).map((t) => ({ value: t, label: t }))} placeholder={selectPlaceholder(teachersLoading, teacherNames.length, "O'qituvchi qo'shilmagan")} clearable disabled={teachersLoading} />
          </div>
          <div>
            <label className={labelCls}>Yordamchi o&apos;qituvchilar</label>
            <Select value={assistant} onChange={(v) => setAssistant(v)} options={withCurrent(teacherNames, assistant).map((t) => ({ value: t, label: t }))} placeholder={selectPlaceholder(teachersLoading, teacherNames.length, "O'qituvchi qo'shilmagan")} clearable disabled={teachersLoading} />
          </div>
          <div>
            <label className={labelCls}>Ta&apos;lim turi<span className="text-rose-500">*</span></label>
            <Select value={eduType} onChange={(v) => setEduType(v)} options={GROUP_FORMATS.map((f) => ({ value: f, label: f }))} />
          </div>
          <div>
            <label className={labelCls}>Xona<span className="text-rose-500">*</span></label>
            <Select value={room} onChange={(v) => setRoom(v)} options={withCurrent(roomNames, room).map((r) => ({ value: r, label: r }))} placeholder={selectPlaceholder(roomsLoading, roomNames.length, "Xona qo'shilmagan")} clearable disabled={roomsLoading} />
          </div>
          <div>
            <label className={labelCls}>Telegram guruh havolasi</label>
            <input value={telegram} onChange={(e) => setTelegram(e.target.value)} type="text" placeholder="https://t.me/..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Boshlanish sanasi</label>
            <DateField value={startDate} onChange={(v) => setStartDate(v)} variant="form" />
          </div>
          <div>
            <label className={labelCls}>Bitkazish sanasi</label>
            <DateField value={endDate} onChange={(v) => setEndDate(v)} variant="form" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          {blocker && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-400 leading-tight">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{blocker}</span>
            </span>
          )}
          <button onClick={modal.close} className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">Orqaga</button>
          <button onClick={save} disabled={saving || blocker !== null} title={blocker ?? undefined} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed">{saving ? "Saqlanmoqda…" : "Saqlash"}</button>
        </div>
      </Modal>
  );
}
