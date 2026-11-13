import type { Db } from "mongodb";
import { SOURCE_FROM_ORDER, SOURCE_OTHER, STUDENT_SOURCES } from "@/constants";
import { BOT_SOURCE, SURVEY_SOURCE } from "@/lib/leadSettings";

// "Manba" TANLOVLARI — o'quvchi qo'shish formasidagi ro'yxat.
//
// Ilgari ro'yxat kodda qotib turardi (constants/index.js → STUDENT_SOURCES)
// va yangi manba qo'shish uchun dasturchi kerak bo'lardi. Endi u bazada
// (`student_sources`) va Sotuv va marketing → O'quvchilar oqimi sahifasidan
// boshqariladi. Konstanta esa URUG' bo'lib qoldi: bo'sh kolleksiya birinchi
// o'qilganda aynan o'sha 7 qiymat yoziladi, ya'ni bugungi tanlovlar
// yo'qolmaydi va mavjud o'quvchilarning `source` matni bilan mos qoladi.
//
// "BOSHQA" BU RO'YXATDA YO'Q — ATAYLAB. U tanlov emas, DARVOZA: tanlansa
// oyna ochiladi va moderator manbani o'z so'zi bilan yozadi (o'sha matn
// `source` ga tushadi). Ro'yxatga kiritilsa uni o'chirib yuborish mumkin
// bo'lardi va "boshqa manba" yozish yo'li butunlay yopilardi.

export const SOURCE_COLLECTION = "student_sources";

export interface StudentSourceOption {
  id: number;
  name: string;
  /**
   * Tizimli yozuv — nomini o'zgartirib ham, o'chirib ham bo'lmaydi.
   *
   * Hozircha yagona bunday qiymat — "Tavsiya". O'quvchilar ro'yxatidagi
   * "Tavsiyalarni yuklash" tugmasi `source === "Tavsiya"` bo'yicha
   * filtrlaydi (components/students/StudentsListPage.tsx), ya'ni nom bir
   * harfga o'zgarsa tugma xatosiz, lekin DOIM BO'SH fayl berardi.
   */
  system?: boolean;
  /**
   * `false` — «Nofaol» (yangi versiya Sozlamalar → Manbalar, 13.11.2026). Nofaol
   * manba yangi tanlovlarda (o'quvchi formasi, so'rovnoma, bot) chiqmaydi, lekin
   * ESKI yozuvlarda matn bo'lib qoladi va hisobotda ko'rinadi. Maydon yo'q — faol
   * (eski hujjatlar migratsiyasiz shunday o'qiladi).
   */
  active?: boolean;
  /**
   * Pullik reklama kanalimi — faqat belgi (13.11.2026). Kassadagi «Reklama»
   * chiqimi bilan bog'lanish hali YO'Q (design/v2/SAVOLLAR.md). Yo'q — bepul.
   */
  paid?: boolean;
}

/**
 * Tanlov nomi bo'la olmaydigan qiymatlar: lid kanallari (`orders.source` ga
 * tizim o'zi yozadi — ro'yxatdagi shu nomli tanlov ular bilan qo'shilib ketardi),
 * "Boshqa" (darvoza, pastdagi izoh) va "Buyurtmadan" (liddan yaratilgan o'quvchi).
 */
export function isReservedSourceName(name: string): boolean {
  const n = name.trim().toLocaleLowerCase("uz");
  return [SURVEY_SOURCE, BOT_SOURCE, SOURCE_OTHER, SOURCE_FROM_ORDER].some((r) => String(r).toLocaleLowerCase("uz") === n);
}

/** Qulflangan qiymatlar — yuqoridagi `system` izohiga qarang. */
const LOCKED = new Set(["Tavsiya"]);

/** Ro'yxat uchun urug' — konstantadan, "Boshqa" siz. */
function seedNames(): string[] {
  return (STUDENT_SOURCES as string[]).filter((s) => s !== SOURCE_OTHER);
}

/**
 * Tanlovlar ro'yxati. Kolleksiya BO'SH bo'lsa avval urug' yoziladi.
 *
 * URUG' FAQAT BO'SH KOLLEKSIYAGA: aks holda admin o'chirgan qiymat har
 * o'qishda tirilib turardi. Yozuv `id` bo'yicha `upsert` bilan ketadi —
 * ikkita so'rov bir vaqtda kelib qolsa ham takror hujjat tug'ilmaydi
 * (ikkalasi ham bir xil `id` ga yozadi).
 */
export async function listSourceOptions(db: Db, opts: { all?: boolean } = {}): Promise<StudentSourceOption[]> {
  const col = db.collection(SOURCE_COLLECTION);
  if ((await col.countDocuments({}, { limit: 1 })) === 0) {
    const names = seedNames();
    await Promise.all(
      names.map((name, i) =>
        col.updateOne(
          { id: i + 1 },
          { $setOnInsert: { id: i + 1, name, system: LOCKED.has(name) } },
          { upsert: true },
        ),
      ),
    );
  }
  // Sukut — faqat FAOL tanlovlar (formalar, so'rovnoma, bot shu yerdan oladi).
  // `all` — boshqaruv sahifasi uchun (nofaollar ham, qayta yoqish uchun).
  const filter = opts.all ? {} : { active: { $ne: false } };
  const rows = await col.find(filter, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  return rows as unknown as StudentSourceOption[];
}

/** Nomni tozalaydi. Bo'sh satr — yaroqsiz. */
export function cleanSourceName(raw: unknown): string {
  // Faqat bo'sh joy kesiladi: qiymat `pupils.source` ga MATN bo'lib tushadi
  // va filtr qat'iy tenglik bilan solishtiradi, ya'ni "Instagram " (ortiqcha
  // probel bilan) ro'yxatga ikkinchi, ko'zga bir xil ko'rinadigan element
  // qo'shib qo'yardi.
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}
