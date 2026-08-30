"use client";

import { useEffect, useMemo, useState } from "react";
import { cachedGet, invalidateCached, peekCached } from "@/lib/clientCache";
import type { PupilListItem } from "@/lib/pupilsData";
import { studentRowFromPupil, type StudentRow } from "@/lib/studentsData";

// O'quvchilarning YAGONA klient manbasi — /api/pupils (MongoDB `pupils`).
//
// Ilgari o'quvchi tanlanadigan/ko'rsatiladigan joylar ikkita statik demo
// ro'yxatdan o'qir edi (constants/index.js -> STUDENTS, constants/
// studentsList.js -> STUDENTS_LIST); ular olib tashlandi. Buyurtma
// panelidagi qidiruvli tanlov esa PupilsProvider (orders-list segmenti)
// orqali ishlaydi — u qo'shilgan o'quvchini darhol ro'yxatga qo'shishi
// kerak, shuning uchun alohida kontekst sifatida qoladi; qolgan hamma joy
// shu hook'dan foydalanadi.
//
// So'rovlar umumiy keshdan o'tadi (lib/clientCache.ts): ilgari bitta sahifa
// ochilishida bir xil ro'yxat ikki-uch marta kelardi — hook'ning o'zi, ustiga
// hook'ni chetlab o'tgan oltita joy alohida so'rardi.

const KEY = "pupils:";
const TTL_MS = 30_000;

/** Ro'yxatni keshdan yoki tarmoqdan oladi. */
export function loadPupilsCached(light = false): Promise<PupilListItem[]> {
  return cachedGet(KEY + (light ? "light" : "full"), TTL_MS, () =>
    fetch(light ? "/api/pupils?light=1" : "/api/pupils")
      .then((r) => r.json())
      .then((d) => {
        // MUHIM: xatoni bo'sh ro'yxatga aylantirmaymiz. Aks holda
        // `enrollOrderInGroup` "o'quvchi topilmadi" deb TAKROR yozuv
        // yaratib yuborardi, ustiga bo'sh natija keshlanib qolardi.
        if (!d?.ok) throw new Error("pupils: ok emas");
        return d.pupils as PupilListItem[];
      }));
}

/**
 * O'quvchi qo'shilgan/o'zgartirilgan/o'chirilgandan keyin CHAQIRILSIN —
 * aks holda ro'yxat TTL tugaguncha eski holatda qolishi mumkin.
 */
export function invalidateStudents(): void {
  invalidateCached(KEY);
}

/**
 * `light` — faqat id, ism va telefon so'raladi (`/api/pupils?light=1`).
 * To'liq hujjatlar ~3.6 MB, yengil ro'yxat ~544 KB. Faqat ism ko'rsatadigan
 * yoki profilga havola yasaydigan joylar shuni ishlatsin; balans/koin kabi
 * maydonlar kerak bo'lsa — standart (to'liq) rejim.
 */
export function useStudents(options?: { light?: boolean }) {
  const light = options?.light === true;
  // Kesh tayyor bo'lsa — birinchi renderdayoq to'liq ro'yxat bilan
  // boshlanadi, ya'ni bo'sh jadval "chaqnab" o'tmaydi.
  const cacheKey = KEY + (light ? "light" : "full");
  const [pupils, setPupils] = useState<PupilListItem[]>(() => peekCached<PupilListItem[]>(cacheKey) ?? []);
  const [loading, setLoading] = useState(() => peekCached<PupilListItem[]>(cacheKey) === null);

  useEffect(() => {
    let cancelled = false;
    loadPupilsCached(light)
      .then((list) => { if (!cancelled) setPupils(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [light]);

  const students = useMemo<StudentRow[]>(() => pupils.map(studentRowFromPupil), [pupils]);
  const names = useMemo(() => students.map((s) => s.name).filter(Boolean), [students]);
  // Ism -> o'quvchi kartasi. Moliya yozuvlarida o'quvchining id'si emas, faqat
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
