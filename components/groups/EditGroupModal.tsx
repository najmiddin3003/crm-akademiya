"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useRooms } from "@/hooks/useRooms";
import { useTeachers } from "@/hooks/useTeachers";
import { GROUP_DAYS, GROUP_EDU_TYPES, GROUP_FORMATS } from "@/constants/groups";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import type { Group } from "@/lib/groups";

// Guruhni tahrirlash modali (skrinshot 1). Guruh maydonlari bilan to'ldirilgan;
// Saqlash → PATCH /api/groups/:id.
//
// Kurs, o'qituvchi va xona ro'yxatlari BAZADAN (/api/offline-courses,
// /api/teachers, /api/rooms) — ilgari constants'dagi qattiq ro'yxatlardan
// kelardi, ya'ni foydalanuvchi qo'shgan o'qituvchi yoki xonani bu yerda
// tanlab bo'lmasdi. Guruhning o'qituvchisi ISM bo'yicha oylik hisobiga
// ulanadi (lib/payrollSources.ts), shu bois ro'yxatdan tashqari ism
// tushum-taqsimotini ham buzardi.
const selectCls = "w-full h-10 appearance-none rounded-lg border border-border bg-card px-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const inputCls = "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

function Chevron() {
  return <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>;
}
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
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  const { names: courseNames, loading: coursesLoading } = useOfflineCourseList();
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

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Guruh nomini kiriting");
      return;
    }
    const time = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || "";
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
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
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
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                <option value="active">Aktiv</option>
                <option value="frozen">Muzlatilgan</option>
                <option value="archive">Arxiv</option>
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Kurs<span className="text-rose-500">*</span></label>
            <div className="relative">
              <select value={course} onChange={(e) => setCourse(e.target.value)} disabled={coursesLoading} className={`${selectCls} disabled:opacity-70`}>
                <option value="">{selectPlaceholder(coursesLoading, courseNames.length, "Kurs qo'shilmagan")}</option>
                {withCurrent(courseNames, course).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Kurs darajasi<span className="text-rose-500">*</span></label>
            <div className="relative">
              <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls}>
                <option value="">Tanlang</option>
                {GROUP_EDU_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Dars kunini tanlang<span className="text-rose-500">*</span></label>
            <div className="relative">
              <select value={day} onChange={(e) => setDay(e.target.value)} className={selectCls}>
                <option value="">Tanlang</option>
                {GROUP_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Boshlanish vaqti</label>
            <div className="flex items-center gap-2 h-10 rounded-lg border border-border bg-card px-3">
              <input value={startTime} onChange={(e) => setStartTime(e.target.value)} type="time" className="flex-1 bg-transparent text-sm outline-none tabular-nums" />
              <button type="button" onClick={() => setStartTime("")} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Tugash vaqti</label>
            <div className="flex items-center gap-2 h-10 rounded-lg border border-border bg-card px-3">
              <input value={endTime} onChange={(e) => setEndTime(e.target.value)} type="time" className="flex-1 bg-transparent text-sm outline-none tabular-nums" />
              <button type="button" onClick={() => setEndTime("")} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div>
            <label className={labelCls}>O&apos;qituvchi<span className="text-rose-500">*</span></label>
            <div className="relative">
              <select value={teacher} onChange={(e) => setTeacher(e.target.value)} disabled={teachersLoading} className={`${selectCls} disabled:opacity-70`}>
                <option value="">{selectPlaceholder(teachersLoading, teacherNames.length, "O'qituvchi qo'shilmagan")}</option>
                {withCurrent(teacherNames, teacher).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Yordamchi o&apos;qituvchilar</label>
            <div className="relative">
              <select value={assistant} onChange={(e) => setAssistant(e.target.value)} disabled={teachersLoading} className={`${selectCls} disabled:opacity-70`}>
                <option value="">{selectPlaceholder(teachersLoading, teacherNames.length, "O'qituvchi qo'shilmagan")}</option>
                {withCurrent(teacherNames, assistant).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Ta&apos;lim turi<span className="text-rose-500">*</span></label>
            <div className="relative">
              <select value={eduType} onChange={(e) => setEduType(e.target.value)} className={selectCls}>
                {GROUP_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Xona<span className="text-rose-500">*</span></label>
            <div className="relative">
              <select value={room} onChange={(e) => setRoom(e.target.value)} disabled={roomsLoading} className={`${selectCls} disabled:opacity-70`}>
                <option value="">{selectPlaceholder(roomsLoading, roomNames.length, "Xona qo'shilmagan")}</option>
                {withCurrent(roomNames, room).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Telegram guruh havolasi</label>
            <input value={telegram} onChange={(e) => setTelegram(e.target.value)} type="text" placeholder="https://t.me/..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Boshlanish sanasi</label>
            <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Bitkazish sanasi</label>
            <input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">Orqaga</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saqlanmoqda…" : "Saqlash"}</button>
        </div>
      </div>
    </div>
  );
}
