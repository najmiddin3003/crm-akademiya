"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// Odam ismini uning profiliga bog'laydigan yagona joy.
//
// MUAMMO: CRM jadvallarining ko'pchiligida odam faqat ISMI bilan turadi
// (`transaction_entries.moderator`, `groups.teacher`, `orders.teacher` …) —
// id yo'q, ya'ni <Link href={...}> yozishning iloji yo'q edi. Shu sababli
// ba'zi sahifalarda ism havola, ba'zilarida oddiy matn bo'lib qolgandi.
//
// YECHIM: /api/people/directory dan ism → id xaritasi sessiyaga BIR MARTA
// yuklanadi (AppShell'da), <PersonLink> esa shu xaritadan foydalanadi.
//
// Katalog hali yuklanmagan yoki ism topilmagan bo'lsa — ism oddiy matn
// bo'lib qolaveradi. Ya'ni bosib bo'lmaydigan "o'lik havola" hech qachon
// ko'rsatilmaydi.

export type PersonKind = "student" | "staff";

interface DirectoryData {
  /** Kalit — normalizeName(ism), qiymat — profil manzili. */
  students: Map<string, string>;
  staff: Map<string, string>;
  loaded: boolean;
}

interface DirectoryValue extends DirectoryData {
  /** Katalogni birinchi marta so'raydi (takroriy chaqiruvlar e'tiborsiz). */
  ensureLoaded: () => void;
}

const EMPTY_DATA: DirectoryData = { students: new Map(), staff: new Map(), loaded: false };

const PersonDirectoryContext = createContext<DirectoryValue>({ ...EMPTY_DATA, ensureLoaded: () => {} });

/**
 * Ismlarni solishtirish uchun kalit. Yozuvlar turli oqimlardan keladi
 * (Excel import, kassa oynasi, qo'lda kiritish), shuning uchun katta-kichik
 * harf va ortiqcha bo'shliqlar hisobga olinmaydi — loyihadagi boshqa
 * ism-solishtirishlar bilan bir xil qoida (lib/teacherOfStudent.ts →
 * nameKey).
 */
function normalizeName(v: unknown): string {
  return String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function PersonDirectoryProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DirectoryData>(EMPTY_DATA);
  // Katalog ~200 KB (6700 o'quvchi). Uni HAR sahifada yuklash isrof bo'lardi:
  // Sozlamalar, Dashboard kabi sahifalarda birorta ism havolasi yo'q.
  // Shuning uchun so'rov faqat BIRINCHI <PersonLink> chizilganda ketadi.
  const requested = useRef(false);

  const ensureLoaded = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    fetch("/api/people/directory")
      .then((r) => r.json())
      .then((d: { ok?: boolean; students?: [number, string][]; staff?: [number, string][] }) => {
        if (!d.ok) return;
        const students = new Map<string, string>();
        for (const [id, name] of d.students ?? []) {
          const key = normalizeName(name);
          // Bir xil ismli ikki o'quvchi bo'lsa BIRINCHISI qoladi va
          // qolganlari e'tiborsiz — noto'g'ri profilga olib borishdan
          // ko'ra, bittasiga aniq olib borgani ma'qul. To'liq to'g'ri
          // yechim jadvallarda ism o'rniga id saqlash bo'lardi.
          if (key && !students.has(key)) students.set(key, `/student-edit/${id}`);
        }
        const staff = new Map<string, string>();
        for (const [id, name] of d.staff ?? []) {
          const key = normalizeName(name);
          if (key && !staff.has(key)) staff.set(key, `/management-xodimlar/${id}`);
        }
        setData({ students, staff, loaded: true });
      })
      .catch(() => {
        // Katalog yuklanmasa sahifa ishlashda davom etadi — ismlar
        // shunchaki havolasiz matn bo'lib qoladi. Qayta urinilmaydi:
        // har bir ism uchun so'rov yog'dirishning ma'nosi yo'q.
      });
  }, []);

  const value = useMemo<DirectoryValue>(() => ({ ...data, ensureLoaded }), [data, ensureLoaded]);

  return <PersonDirectoryContext.Provider value={value}>{children}</PersonDirectoryContext.Provider>;
}

/**
 * Ismga mos profil manzili. Topilmasa null.
 *
 * `kind` berilmasa avval XODIMLAR, keyin o'quvchilar orasidan qidiriladi.
 * Sababi: ism ko'rsatilgan ustunlarning aksariyati (moderator, o'qituvchi,
 * mas'ul) xodimga tegishli. Chaqiruvchi bilsa — aniq `kind` bergani ma'qul.
 */
export function usePersonHref(name: unknown, kind?: PersonKind): string | null {
  const dir = useContext(PersonDirectoryContext);
  const key = normalizeName(name);

  // Shu hook ishlatilgani — sahifada ism ko'rsatilayotgani demak, ya'ni
  // katalog kerak. Birinchi chaqiruv uni yuklaydi.
  const { ensureLoaded } = dir;
  useEffect(() => {
    if (key) ensureLoaded();
  }, [key, ensureLoaded]);

  if (!key || !dir.loaded) return null;
  if (kind === "student") return dir.students.get(key) ?? null;
  if (kind === "staff") return dir.staff.get(key) ?? null;
  return dir.staff.get(key) ?? dir.students.get(key) ?? null;
}

export interface PersonLinkProps {
  /** Ko'rsatiladigan ism. Bo'sh bo'lsa `fallback` chiziladi. */
  name: unknown;
  /**
   * Qaysi ro'yxatdan qidirilsin. Berilmasa — avval xodimlar, keyin
   * o'quvchilar.
   *
   * MUHIM: `transaction_entries` da chiqim yozuvining `studentName`
   * maydonida XODIM ismi turadi (app/api/cashboxes/[id]/adjust/route.ts),
   * shuning uchun tranzaksiya jadvallarida `kind` berilmaydi — avtomatik
   * aniqlansin.
   */
  kind?: PersonKind;
  /** Ism bo'sh bo'lganda ko'rsatiladigan belgi. */
  fallback?: string;
  /** Havolaga qo'shiladigan sinflar (matn holatiga ta'sir qilmaydi). */
  className?: string;
}

/**
 * Odam ismi — profiliga havola bilan. Katalogda topilmasa oddiy matn.
 *
 * Havola `stopPropagation` qiladi: ism ko'pincha bosiladigan qator ichida
 * turadi (qator bosilganda tafsilot oynasi ochiladi), ikkalasi bir vaqtda
 * ishlab ketmasligi kerak.
 */
export default function PersonLink({ name, kind, fallback = "—", className = "" }: PersonLinkProps) {
  const text = String(name ?? "").trim();
  const href = usePersonHref(text, kind);

  if (!text) return <>{fallback}</>;
  if (!href) return <>{text}</>;

  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={`hover:text-primary hover:underline ${className}`}
    >
      {text}
    </Link>
  );
}

/** Katalog yuklanganini bilish kerak bo'lgan kamdan-kam holatlar uchun. */
export function usePersonDirectoryLoaded(): boolean {
  return useContext(PersonDirectoryContext).loaded;
}

export { normalizeName as normalizePersonName };
