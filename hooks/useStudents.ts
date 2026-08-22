"use client";

import { useEffect, useMemo, useState } from "react";
import type { Pupil } from "@/lib/pupilsData";
import { studentRowFromPupil, type StudentRow } from "@/lib/studentsData";

// O'quvchilarning YAGONA klient manbasi — /api/pupils (MongoDB `pupils`).
//
// Ilgari o'quvchi tanlanadigan/ko'rsatiladigan joylar ikkita statik demo
// ro'yxatdan o'qir edi (constants/index.js → STUDENTS, constants/
// studentsList.js → STUDENTS_LIST); ular olib tashlandi. Buyurtma
// panelidagi qidiruvli tanlov esa PupilsProvider (orders-list segmenti)
// orqali ishlaydi — u qo'shilgan o'quvchini darhol ro'yxatga qo'shishi
// kerak, shuning uchun alohida kontekst sifatida qoladi; qolgan hamma joy
// shu hook'dan foydalanadi.
export function useStudents() {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pupils")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setPupils(d.pupils); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const students = useMemo<StudentRow[]>(() => pupils.map(studentRowFromPupil), [pupils]);
  const names = useMemo(() => students.map((s) => s.name).filter(Boolean), [students]);
  // Ism → o'quvchi kartasi. Moliya yozuvlarida o'quvchining id'si emas, faqat
  // ISMI saqlanadi, shuning uchun profil havolasi/telefoni ism bo'yicha
  // topiladi (katta-kichik harf va ortiqcha bo'shliq farq qilmaydi).
  const byName = useMemo(() => {
    const map = new Map<string, StudentRow>();
    for (const s of students) {
      const key = s.name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, s);
    }
    return map;
  }, [students]);

  return { pupils, students, names, byName, loading };
}
