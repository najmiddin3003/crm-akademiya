"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { GROUPS } from "@/constants";
import { COURSES, LESSON_DAY_PATTERNS, TEACHERS, type NewOrderValues, type Order } from "@/lib/ordersData";
import { usePupils } from "@/components/orders/PupilsContext";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import PanelSelect from "@/components/orders/PanelSelect";
import PanelTimeField from "@/components/orders/PanelTimeField";
import AddStudentModal from "@/components/orders/AddStudentModal";

// Redesigned (2026-07-16) to match the current production "Yangi buyurtma"
// side panel (akademiya.edutizim.uz), which has moved on from the
// centered-modal shape captured in the ported crm-akademiya/src/app.js
// openAddOrderModal() snapshot. Field set/layout follow the reference
// screenshot; the sliding-panel shell reuses the .st-drawer/.st-drawer-*
// classes already ported into globals.css (used elsewhere for the student
// timeline / filter drawers), so no new arbitrary CSS was needed.

export type { NewOrderValues } from "@/lib/ordersData";

export interface AddOrderModalProps {
  /** Prefills every field from an existing order — used by the edit flow. */
  initialOrder?: Order;
  /** Prefills only the student — used by "Buyurtma yaratish" on a student's
   * own order-detail page, where the new order is for that same student. */
  initialStudentName?: string;
  initialStudentPhone?: string;
  onClose: () => void;
  onSave: (values: NewOrderValues) => void | Promise<void>;
}

function parseFirstLesson(firstLesson: string): { date: string; time: string } {
  if (!firstLesson) return { date: "", time: "" };
  const [datePart, timePart] = firstLesson.split("|").map((s) => s.trim());
  const m = datePart.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return { date: m ? `${m[3]}-${m[2]}-${m[1]}` : "", time: timePart || "" };
}

export default function AddOrderModal({ initialOrder, initialStudentName, initialStudentPhone, onClose, onSave }: AddOrderModalProps) {
  const [mounted, setMounted] = useState(false);
  const [studentName, setStudentName] = useState(initialOrder?.name ?? initialStudentName ?? "");
  const [referral, setReferral] = useState(initialOrder?.referral ?? "");
  const [course, setCourse] = useState(initialOrder?.course ?? "");
  const [lessonDay, setLessonDay] = useState(initialOrder?.lessonDay ?? "");
  const [lessonStartTime, setLessonStartTime] = useState(initialOrder?.lessonStartTime ?? "");
  const [teacher, setTeacher] = useState(initialOrder?.teacher ?? "");
  const [group, setGroup] = useState(initialOrder?.group ?? "");
  const [firstLessonDate, setFirstLessonDate] = useState(() => parseFirstLesson(initialOrder?.firstLesson ?? "").date);
  const [firstLessonTime, setFirstLessonTime] = useState(() => parseFirstLesson(initialOrder?.firstLesson ?? "").time);
  const [note, setNote] = useState(initialOrder?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [addStudentOpen, setAddStudentOpen] = useState(false);
  // O'quvchi qo'shish orqali MongoDB'ga saqlangan haqiqiy o'quvchilar
  // (constants/index.js'dagi statik 50 ta demo STUDENTS ro'yxati emas) —
  // shared PupilsContext orqali, shu bois avvalgi sessiyalarda qo'shilganlar
  // ham qidiruvda ko'rinadi.
  const { pupils } = usePupils();

  useEscapeClose(onClose);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = "";
    };
  }, []);

  const studentOptions = useMemo(() => {
    const names = pupils.map((p) => `${p.firstName} ${p.lastName}`.trim());
    // Buyurtmani tahrirlashda yoki shu o'quvchiga yangi buyurtma yaratishda
    // ism pupils ro'yxatida bo'lmasligi mumkin (masalan demo buyurtmalar
    // ma'lumotlaridan) — shunday bo'lsa ham qidiruvda ko'rinsin.
    const preset = initialOrder?.name ?? initialStudentName;
    if (preset && !names.includes(preset)) names.unshift(preset);
    return Array.from(new Set(names));
  }, [pupils, initialOrder, initialStudentName]);

  const phoneFor = (name: string): string => {
    if (initialOrder && name === initialOrder.name) return initialOrder.phone;
    if (initialStudentName && name === initialStudentName) return initialStudentPhone ?? "";
    const pupil = pupils.find((p) => `${p.firstName} ${p.lastName}`.trim() === name);
    return pupil?.phone ?? "";
  };

  const handleSave = async () => {
    if (!studentName) {
      setError("O'quvchi majburiy");
      return;
    }
    if (!course) {
      setError("Kurs majburiy");
      return;
    }
    if (!lessonDay) {
      setError("Dars kunini tanlang majburiy");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        studentName,
        phone: phoneFor(studentName),
        referral,
        course,
        lessonDay,
        lessonStartTime,
        teacher,
        group,
        firstLessonDate,
        firstLessonTime,
        note,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className={`st-drawer-backdrop${mounted ? " visible" : ""}`} onClick={onClose}>
      <div className={`st-drawer${mounted ? " visible" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 pb-0 shrink-0">
          <div>
            <h3 className="text-lg font-semibold">Yangi buyurtma</h3>
            <p className="text-xs text-muted-foreground mt-1">* Zarurligini bildiradi</p>
          </div>
          <button type="button" className="st-drawer-close" onClick={onClose} title="Yopish (Esc)">
            <svg className="icon icon-sm">
              <use href="#i-x-circle" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Button variant="primary" className="w-full justify-center" onClick={() => setAddStudentOpen(true)}>
            O&apos;quvchi qo&apos;shish
          </Button>

          <StudentSearchSelect
            label="O'quvchi"
            required
            value={studentName}
            onChange={(v) => {
              setStudentName(v);
              setError(null);
            }}
            options={studentOptions}
            error={error === "O'quvchi majburiy"}
          />

          <StudentSearchSelect label="Referal bergan o'quvchi" value={referral} onChange={setReferral} options={studentOptions} />

          <PanelSelect
            label="Kurs"
            required
            value={course}
            onChange={(v) => {
              setCourse(v);
              setError(null);
            }}
            options={COURSES}
            placeholder="Kursni tanlang"
            error={error === "Kurs majburiy"}
          />

          <PanelSelect
            label="Dars kunini tanlang"
            required
            value={lessonDay}
            onChange={(v) => {
              setLessonDay(v);
              setError(null);
            }}
            options={LESSON_DAY_PATTERNS}
            error={error === "Dars kunini tanlang majburiy"}
          />

          <PanelTimeField label="Darsning boshlanish vaqtini tanlang" value={lessonStartTime} onChange={setLessonStartTime} />

          <PanelSelect label="O'qituvchi" value={teacher} onChange={setTeacher} options={TEACHERS.filter(Boolean)} placeholder="Ustozni tanlang" />

          <PanelSelect
            label="Yig'ilayotgan guruhni tanlang"
            value={group}
            onChange={setGroup}
            options={GROUPS}
            placeholder="Yig'ilayotgan guruhni tanlang"
          />

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Birinchi darsga kelish sanasi</label>
            <input
              type="date"
              value={firstLessonDate}
              onChange={(e) => setFirstLessonDate(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <PanelTimeField label="Birinchi darsga kelish vaqti" value={firstLessonTime} onChange={setFirstLessonTime} />

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Izoh</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Izoh"
              className="w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {error && <div className="text-sm text-red-600">⚠ {error}</div>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border bg-card shrink-0">
          <Button variant="outline" onClick={onClose}>
            Orqaga
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </div>
    </div>
    {addStudentOpen && (
      <AddStudentModal
        onClose={() => setAddStudentOpen(false)}
        onSave={(pupil) => {
          setStudentName(`${pupil.firstName} ${pupil.lastName}`.trim());
          setError(null);
          setAddStudentOpen(false);
        }}
      />
    )}
    </>
  );
}
