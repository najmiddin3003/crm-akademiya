"use client";

import { useMemo } from "react";
import { useReferenceList } from "@/hooks/useReferenceList";
import { makeReferenceLoader, REF_KEYS, invalidateReference } from "@/lib/referenceCache";
import type { EduCategory } from "@/lib/eduCategories";

// O'quv bo'limi → Kategoriya ro'yxatining YAGONA klient manbasi
// (/api/edu-categories). Ilgari kategoriyalarni faqat o'z boshqaruv
// sahifasi o'qirdi; onlayn kurs g'ilofchisidagi "Kategoriya" select'i
// ham shu yerdan oladi. Boshqa data hook'lar bilan bir xil qolip
// (hooks/useBranches.ts).
const loadEduCategories = makeReferenceLoader<EduCategory>(REF_KEYS.eduCategories, "/api/edu-categories", "categories");

export function useEduCategories() {
  const { items: categories, loading } = useReferenceList(REF_KEYS.eduCategories, loadEduCategories);
  return { categories, loading };
}

/**
 * O'quvchi kategoriyasi tanlovlari uchun — FAQAT NOMLAR.
 *
 * NEGA SHU RO'YXAT: ilgari bu tanlovlar `useSettingsListNames("student-categories", …)`
 * dan o'qirdi, ya'ni Sozlamalar → Sotuv va marketing → Kategoriya'dan. O'sha
 * ro'yxat bazada BO'SH edi (o'lchandi: `settings_student_categories` — 0 ta
 * yozuv), demak amalda hamma joyda `STUDENT_CATEGORIES` konstantasining
 * uchtaligi ko'rinardi. Foydalanuvchi kategoriyalarni O'quv bo'limi →
 * Kategoriya sahifasida yuritadi (`edu_categories`, 10 ta), shu bois manba
 * YAGONA shu sahifa qilib qo'yildi — bitta maydonga ikkita boshqaruv joyi
 * eng ko'p adashtiradigan narsa.
 *
 * `current` — maydonning HOZIRGI qiymati. Ro'yxatda bo'lmasa oxiriga
 * QO'SHILADI: `<select>` ro'yxatda yo'q qiymatni umuman ko'rsatmaydi, ya'ni
 * eski kategoriyali ("Kichik (1-4-sinf)" — bazada 123 ta o'quvchi) yozuv
 * bo'sh ko'rinib, saqlashda jimgina o'chib ketardi. Naqsh loyihada bor:
 * AddStudentModal'dagi `sourceOptions` va AddOrderModal'dagi `teacherOptions`.
 */
export function useEduCategoryNames(current?: string) {
  const { categories, loading } = useEduCategories();
  const names = useMemo(() => {
    const base = categories.map((c) => c.name).filter(Boolean);
    return current && !base.includes(current) ? [...base, current] : base;
  }, [categories, current]);
  return { names, loading };
}

/** Yo'nalish qo'shilgan/o'zgartirilgan/o'chirilgandan keyin CHAQIRILSIN. */
export function invalidateEduCategories(): void {
  invalidateReference(REF_KEYS.eduCategories);
}
