"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useGroups } from "@/hooks/useGroups";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { formatLessonDays, parseLessonDays, type NewOrderValues, type Order } from "@/lib/ordersData";
import { useTeachers } from "@/hooks/useTeachers";
import { usePupils } from "@/components/orders/PupilsContext";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import PanelDaysField from "@/components/orders/PanelDaysField";
import PanelTimeField, { normalizeTime } from "@/components/orders/PanelTimeField";
import AddStudentModal from "@/components/orders/AddStudentModal";
import DateField from "@/components/ui/DateField";
import { useT } from "@/components/shared/Language";
import { pupilIdByName } from "@/lib/pupilsData";

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
  return { date: m ? `${m[3]}-${m[2]}-${m[1]}` : "", time: normalizeTime(timePart) };
}

export default function AddOrderModal({ initialOrder, initialStudentName, initialStudentPhone, onClose, onSave }: AddOrderModalProps) {
  const { t } = useT();
  // Kurs va guruh ro'yxatlari bazadan — ilgari constants'dagi qattiq
  // ro'yxatlar edi, ya'ni haqiqiy guruhga yozib bo'lmasdi.
  const { names: courseNames, loading: coursesLoading } = useOfflineCourseList();
  const { groups, loading: groupsLoading } = useGroups();
  const groupNames = useMemo(() => groups.map((g) => g.name).filter(Boolean), [groups]);
  const [mounted, setMounted] = useState(false);
  const [studentName, setStudentName] = useState(initialOrder?.name ?? initialStudentName ?? "");
  const [referral, setReferral] = useState(initialOrder?.referral ?? "");
  const [course, setCourse] = useState(initialOrder?.course ?? "");
  // Kunlar "Du,Ch,Ju" ko'rinishida saqlanadi; eski yozuvdagi naqsh nomi
  // ("Toq kunlar") ham shu ko'rinishga yoyiladi.
  const [lessonDay, setLessonDay] = useState(() => formatLessonDays(parseLessonDays(initialOrder?.lessonDay)));
  const [lessonStartTime, setLessonStartTime] = useState(() => normalizeTime(initialOrder?.lessonStartTime));
  const [teacher, setTeacher] = useState(initialOrder?.teacher ?? "");
  const [group, setGroup] = useState(initialOrder?.group ?? "");
  const [firstLessonDate, setFirstLessonDate] = useState(() => parseFirstLesson(initialOrder?.firstLesson ?? "").date);
  const [firstLessonTime, setFirstLessonTime] = useState(() => parseFirstLesson(initialOrder?.firstLesson ?? "").time);
  const [note, setNote] = useState(initialOrder?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Buyurtma detali sahifasidagi "Buyurtma yaratish" tugmasi o'quvchini
  // oldindan beradi — bunday holatda o'quvchi qat'iy, almashtirib bo'lmaydi.
  const studentLocked = Boolean(initialStudentName);

  const [addStudentOpen, setAddStudentOpen] = useState(false);
  // O'quvchi qo'shish orqali MongoDB'ga saqlangan haqiqiy o'quvchilar
  // (constants/index.js'dagi statik 50 ta demo STUDENTS ro'yxati emas) —
  // shared PupilsContext orqali, shu bois avvalgi sessiyalarda qo'shilganlar
  // ham qidiruvda ko'rinadi.
  const { pupils, loading: pupilsLoading, phoneOf } = usePupils();
  // "O'qituvchi" ro'yxati — Boshqaruv → Xodimlardagi HAQIQIY o'qituvchilar
  // (/api/teachers), avvalgi qattiq yozilgan TEACHERS massivi emas.
  const { names: teacherNames, loading: teachersLoading } = useTeachers();

  // Ustida "Yangi o'quvchi" modali ochiq bo'lsa Esc FAQAT uni yopsin (u
  // o'zi ui/Modal orqali tinglaydi) — aks holda bitta Esc drawer'ni ham
  // yopib, yarim to'ldirilgan buyurtma yo'qolardi.
  useEscapeClose(addStudentOpen ? () => {} : onClose);

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

  // Buyurtma tahrirlanayotganda unda yozilgan o'qituvchi endi ro'yxatda
  // bo'lmasligi mumkin (arxivlangan yoki eski demo nom) — u ham ko'rinsin,
  // aks holda tanlov jimgina bo'shab qoladi.
  const teacherOptions = useMemo(() => {
    if (teacher && !teacherNames.includes(teacher)) return [teacher, ...teacherNames];
    return teacherNames;
  }, [teacherNames, teacher]);

  const phoneFor = (name: string): string => {
    if (initialOrder && name === initialOrder.name) return initialOrder.phone;
    if (initialStudentName && name === initialStudentName) return initialStudentPhone ?? "";
    const pupil = pupils.find((p) => `${p.firstName} ${p.lastName}`.trim() === name);
    return pupil?.phone ?? "";
  };

  const handleSave = async () => {
    if (!studentName) {
      setError(t("O'quvchi majburiy"));
      return;
    }
    if (!course) {
      setError(t("Kurs majburiy"));
      return;
    }
    if (!lessonDay) {
      setError(t("Dars kunini tanlang majburiy"));
      return;
    }
    // Vaqt sanasiz saqlanmaydi (lib/ordersData.ts → firstLessonFromValues),
    // shuning uchun jimgina yo'qotmasdan ogohlantiramiz.
    if (firstLessonTime && !firstLessonDate) {
      setError(t("Birinchi darsga kelish sanasini tanlang"));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        studentName,
        phone: phoneFor(studentName),
        referral,
        referralPupilId: pupilIdByName(pupils, referral),
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
            <h3 className="text-lg font-semibold">{t("Yangi buyurtma")}</h3>
            <p className="text-xs text-muted-foreground mt-1">{t("* Zarurligini bildiradi")}</p>
          </div>
          <button type="button" className="st-drawer-close" onClick={onClose} title={t("Yopish (Esc)")}>
            <svg className="icon icon-sm">
              <use href="#i-x-circle" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* O'quvchi detal sahifasidan ("Buyurtma yaratish") kelganda buyurtma
              FAQAT o'sha o'quvchiga yaratiladi — boshqasini tanlash ham,
              yangi o'quvchi qo'shish ham mumkin emas. */}
          {!studentLocked && (
            <Button variant="primary" className="w-full justify-center" onClick={() => setAddStudentOpen(true)}>
              {t("O'quvchi qo'shish")}
            </Button>
          )}

          {studentLocked ? (
            <div>
              <label className="block text-[13px] font-medium mb-1.5">
                {t("O'quvchi")}<span className="text-red-500"> *</span>
              </label>
              <div className="flex h-11 w-full items-center rounded-lg border border-border bg-secondary/30 px-3 text-sm text-muted-foreground">
                {studentName}
              </div>
            </div>
          ) : (
            <StudentSearchSelect
              label={t("O'quvchi")}
              required
              value={studentName}
              onChange={(v) => {
                setStudentName(v);
                setError(null);
              }}
              options={studentOptions}
              loading={pupilsLoading}
              error={error === "O'quvchi majburiy"}
              // Telefon ost-satr sifatida ko'rinadi VA qidiruvga qo'shiladi
              // — moderator "941558855" deb yozib ham topa oladi
              // (StudentSearchSelect raqamlarni ajratkichlarsiz solishtiradi).
              // Ustiga bir xil ismli o'quvchilarni ajratish imkonini beradi.
              subtitleOf={phoneOf}
            />
          )}

          <StudentSearchSelect
            label={t("Referal bergan o'quvchi")}
            value={referral}
            onChange={setReferral}
            options={studentOptions}
            loading={pupilsLoading}
            subtitleOf={phoneOf}
          />

          <StudentSearchSelect
            label={t("Kurs")}
            required
            value={course}
            onChange={(v) => {
              setCourse(v);
              setError(null);
            }}
            options={courseNames}
            loading={coursesLoading}
            placeholder={t("Kursni tanlang")}
            searchPlaceholder="Kursni qidirish"
            error={error === "Kurs majburiy"}
          />

          <PanelDaysField
            label={t("Dars kunini tanlang")}
            required
            value={lessonDay}
            onChange={(v) => {
              setLessonDay(v);
              setError(null);
            }}
            error={error === "Dars kunini tanlang majburiy"}
          />

          <PanelTimeField label={t("Darsning boshlanish vaqtini tanlang")} value={lessonStartTime} onChange={setLessonStartTime} />

          {/* O'qituvchi va guruh — brauzerning o'z <select> ro'yxati emas,
              yuqoridagi "O'quvchi" maydoni bilan bir xil qidiruvli tanlov
              (StudentSearchSelect): ro'yxat uzun bo'lsa ham yozib topiladi va
              ko'rinishi CRM'ning qolgan qismiga mos tushadi. */}
          <StudentSearchSelect
            label={t("O'qituvchi")}
            value={teacher}
            onChange={setTeacher}
            options={teacherOptions}
            loading={teachersLoading}
            placeholder={t("Ustozni tanlang")}
            searchPlaceholder="Ustozni qidirish"
            emptyText={t("Bu filialga o'qituvchi biriktirilmagan — Boshqaruv > Xodimlar bo'limidan biriktiring")}
          />

          <StudentSearchSelect
            label={t("Yig'ilayotgan guruhni tanlang")}
            value={group}
            onChange={setGroup}
            options={groupNames}
            loading={groupsLoading}
            placeholder={t("Yig'ilayotgan guruhni tanlang")}
            searchPlaceholder="Guruhni qidirish"
            emptyText={t("Bu filialda guruh yo'q — avval Guruh bo'limidan qo'shing")}
          />

          <div>
            <label className="block text-[13px] font-medium mb-1.5">
              Birinchi darsga kelish sanasi
              {firstLessonTime && <span className="text-red-500"> *</span>}
            </label>
            {/* Nativ <input type="date"> brauzer tiliga qarab "дд.мм.гггг"
                ko'rinishini beradi — o'rniga Topshiriq oynasidagi kalendar
                (components/ui/DateField). */}
            <DateField
              variant="panel"
              value={firstLessonDate}
              onChange={(iso) => {
                setFirstLessonDate(iso);
                setError(null);
              }}
              error={error === "Birinchi darsga kelish sanasini tanlang"}
            />
          </div>

          <PanelTimeField
            label={t("Birinchi darsga kelish vaqti")}
            value={firstLessonTime}
            onChange={(v) => {
              setFirstLessonTime(v);
              setError(null);
            }}
          />

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Izoh")}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("Izoh")}
              rows={4}
              className="w-full min-h-24 px-3 py-2 rounded-lg border border-border bg-secondary/30 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {error && <div className="text-sm text-red-600">⚠ {error}</div>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border bg-card shrink-0">
          <Button variant="outline" onClick={onClose}>
            {t("Orqaga")}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? t("Saqlanmoqda...") : t("Saqlash")}
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
