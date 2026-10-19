"use client";

import { useEffect, useMemo, useState } from "react";
import { SOURCE_OTHER, STUDENT_SOURCES } from "@/constants";

// O'QUVCHI MANBASI («qayerdan keldi») TANLOVLARI — eski «Yangi o'quvchi qo'shish»
// oynasi (./AddStudentModal.tsx) va yangi versiya o'ngdan paneli
// (components/v2/students/NewStudentDrawerV2.tsx) uchun BITTA manba. 19.10.2026
// da eski oynadan izohlari bilan AYNAN ko'chirildi.

export function useStudentSources(source: string) {
  /**
   * Manba tanlovlari BAZADAN — Sotuv va marketing → O'quvchilar oqimi
   * sahifasidagi "Manbalar ro'yxati" oynasidan boshqariladi.
   *
   * KONSTANTA ZAXIRA bo'lib qoladi: so'rov yiqilsa yoki hali kelmagan
   * bo'lsa ro'yxat bo'sh chiqmasligi kerak — "Manba" MAJBURIY maydon,
   * ya'ni bo'sh tanlov butun formani saqlab bo'lmaydigan qilib qo'yardi.
   */
  const [dbSources, setDbSources] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/student-sources/options")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const names = (d.options as { name: string }[]).map((o) => o.name).filter(Boolean);
        if (names.length > 0) setDbSources(names);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /**
   * `<select>` da ko'rsatiladigan variantlar.
   *
   * "Boshqa" DOIM oxirida — u ro'yxatning bir qismi emas, darvoza
   * (pastdagi `pickSource` izohiga qarang) va bazadagi ro'yxatda saqlanmaydi.
   *
   * Qo'lda yozilgan manba (masalan "Maktabdan eshitgan") ro'yxatda YO'Q,
   * `PanelSelect` esa oddiy `<select>` — ro'yxatda yo'q qiymat umuman
   * ko'rinmaydi va maydon bo'sh turgandek tuyulardi. Shu bois yozilgan
   * qiymat oxiriga QO'SHILADI. Naqsh loyihada bor (AddOrderModal ham
   * tahrirlashda joriy qiymatni ro'yxat boshiga qo'shadi).
   */
  const knownSources = useMemo(
    () => dbSources ?? (STUDENT_SOURCES as string[]).filter((s) => s !== SOURCE_OTHER),
    [dbSources],
  );
  const sourceOptions = useMemo(() => {
    const base = [...knownSources, SOURCE_OTHER];
    return source && !base.includes(source) ? [...base, source] : base;
  }, [knownSources, source]);

  return { knownSources, sourceOptions };
}
