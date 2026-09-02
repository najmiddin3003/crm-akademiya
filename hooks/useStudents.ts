"use client";

import { useEffect, useMemo, useState } from "react";
import { cachedGet, invalidateCached, peekCached } from "@/lib/clientCache";
import type { Pupil, PupilExtraField, PupilListItem } from "@/lib/pupilsData";
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

/** So'rovni bir xil ko'rinishga keltiradi — kesh kaliti ham shundan. */
export interface PupilsQuery {
  /** Faqat id/ism/telefon (`?light=1`). Qo'shimcha maydonlar bilan birga ISHLAMAYDI. */
  light?: boolean;
  /** Asosiy to'plam ustiga qo'shimcha maydonlar (`?extra=`). */
  extra?: readonly PupilExtraField[];
  /** Holat bo'yicha server filtri (`?status=Aktiv`). */
  status?: string;
  /** Faqat ota-ona ma'lumoti bor o'quvchilar (`?hasParent=1`). */
  hasParent?: boolean;
  /** Faqat tug'ilgan sanasi kiritilganlar (`?hasBirthDate=1`). */
  hasBirthDate?: boolean;
  /** Faqat manzili borlar (`?hasAddress=1`). */
  hasAddress?: boolean;
}

/**
 * Kesh kaliti so'rovning HAMMA qismini o'z ichiga oladi.
 *
 * Bu SHART: aks holda `?extra=birthDate` so'ragan sahifa, undan oldin
 * qo'shimchasiz so'ragan sahifaning keshiga tushib qolardi va `birthDate`
 * jimgina `undefined` bo'lardi. Qo'shimchalar SARALANADI — ["a","b"] va
 * ["b","a"] bir xil so'rov, ikki marta tortilmasin.
 */
function queryKey(q: PupilsQuery): string {
  const tail = (q.status ? "|" + q.status : "") + (q.hasParent ? "|hasParent" : "") +
    (q.hasBirthDate ? "|hasBirthDate" : "") + (q.hasAddress ? "|hasAddress" : "");
  if (q.light) return KEY + "light" + tail;
  const extra = q.extra?.length ? "+" + [...q.extra].sort().join(",") : "";
  return KEY + "full" + extra + tail;
}

function queryUrl(q: PupilsQuery): string {
  const sp = new URLSearchParams();
  if (q.light) sp.set("light", "1");
  else if (q.extra?.length) sp.set("extra", [...q.extra].sort().join(","));
  if (q.status) sp.set("status", q.status);
  if (q.hasParent) sp.set("hasParent", "1");
  if (q.hasBirthDate) sp.set("hasBirthDate", "1");
  if (q.hasAddress) sp.set("hasAddress", "1");
  const qs = sp.toString();
  return "/api/pupils" + (qs ? "?" + qs : "");
}

/** Ro'yxatni keshdan yoki tarmoqdan oladi. */
export function loadPupilsCached<K extends PupilExtraField = never>(
  query: PupilsQuery | boolean = {},
): Promise<(PupilListItem & Pick<Pupil, K>)[]> {
  // Eski chaqiruv shakli — `loadPupilsCached(true)` — hali ishlaydi.
  const q: PupilsQuery = typeof query === "boolean" ? { light: query } : query;
  return cachedGet(queryKey(q), TTL_MS, () =>
    fetch(queryUrl(q))
      .then((r) => r.json())
      .then((d) => {
        // MUHIM: xatoni bo'sh ro'yxatga aylantirmaymiz. Aks holda
        // `enrollOrderInGroup` "o'quvchi topilmadi" deb TAKROR yozuv
        // yaratib yuborardi, ustiga bo'sh natija keshlanib qolardi.
        if (!d?.ok) throw new Error("pupils: ok emas");
        return d.pupils as (PupilListItem & Pick<Pupil, K>)[];
      }));
}

/**
 * O'quvchi qo'shilgan/o'zgartirilgan/o'chirilgandan keyin CHAQIRILSIN —
 * aks holda ro'yxat TTL tugaguncha eski holatda qolishi mumkin.
 *
 * Prefiks bo'yicha bekor qiladi, ya'ni HAMMA variant (light, qo'shimchali,
 * holat bo'yicha filtrlangan) birdan tozalanadi.
 */
export function invalidateStudents(): void {
  invalidateCached(KEY);
}

/**
 * `light` — faqat id, ism va telefon (`?light=1`, 0.53 MB). Faqat ism
 * ko'rsatadigan yoki profilga havola yasaydigan joylar shuni ishlatsin.
 *
 * Standart rejim — asosiy 13 maydon (1.64 MB). Ota-ona, manzil, tug'ilgan
 * sana va to'lov sanasi UNDA YO'Q: ular `extra` bilan ALOHIDA so'raladi,
 * chunki 13 ta sahifadan atigi 4 tasiga kerak.
 *
 *     const { pupils } = useStudents({ extra: ["birthDate"] as const });
 *     pupils[0].birthDate   // OK
 *     pupils[0].address     // kompilyatsiya xatosi — so'ralmagan
 *
 * `status` — serverda filtrlaydi. Aktiv o'quvchilar sahifasi 6 732 tadan
 * 4 276 tasini ko'rsatadi, Arxiv esa 2 456 tasini; qolganini brauzerga
 * tashib, keyin tashlab yuborishning ma'nosi yo'q.
 */
export function useStudents<K extends PupilExtraField = never>(options?: {
  light?: boolean;
  extra?: readonly K[];
  status?: string;
  hasParent?: boolean;
  /** Faqat tug'ilgan sanasi kiritilganlar — Tug'ilgan kunlar sahifasi. */
  hasBirthDate?: boolean;
  /** Faqat manzili borlar — O'quvchi manzillari sahifasi. */
  hasAddress?: boolean;
}) {
  const light = options?.light === true;
  const status = options?.status;
  const hasParent = options?.hasParent === true;
  const hasBirthDate = options?.hasBirthDate === true;
  const hasAddress = options?.hasAddress === true;
  // Massiv har renderda yangi bo'ladi — effekt bog'liqligi uchun uni
  // barqaror satrga aylantiramiz.
  const extraKey = options?.extra?.length ? [...options.extra].sort().join(",") : "";

  const cacheKey = queryKey({ light, extra: options?.extra, status, hasParent, hasBirthDate, hasAddress });
  type Row = PupilListItem & Pick<Pupil, K>;
  // Kesh tayyor bo'lsa — birinchi renderdayoq to'liq ro'yxat bilan
  // boshlanadi, ya'ni bo'sh jadval "chaqnab" o'tmaydi.
  const [pupils, setPupils] = useState<Row[]>(() => peekCached<Row[]>(cacheKey) ?? []);
  const [loading, setLoading] = useState(() => peekCached<Row[]>(cacheKey) === null);

  useEffect(() => {
    let cancelled = false;
    const extra = extraKey ? (extraKey.split(",") as K[]) : undefined;
    loadPupilsCached<K>({ light, extra, status, hasParent, hasBirthDate, hasAddress })
      .then((list) => { if (!cancelled) setPupils(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [light, extraKey, status, hasParent, hasBirthDate, hasAddress]);

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
