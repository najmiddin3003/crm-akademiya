import type { Db } from "mongodb";
import { cyrToLat, normalizeSearch } from "@/lib/globalSearch";
import { loadPupilNames } from "@/lib/studentBot/data";
import { findPupilsByPhone, type PupilMatch } from "@/lib/studentBot/phone";

// ISM + RAQAM bo'yicha o'quvchini topish (04.11.2026).
//
// Ota-ona formasi (lib/studentBot/parentForm.ts) va bot anketasi
// (lib/studentBot/signup.ts) shu yerdan foydalanadi: ikkalasida ham odam ism
// familiyani QO'LDA yozadi, kartada esa boshqacha turgan bo'lishi mumkin.
//
// RAQAM — ASOSIY, ISM — IKKINCHI TEKSHIRUV. Qidiruv raqamdan boshlanadi, ya'ni
// ism yolg'iz o'zi hech kimni ochmaydi. Shu bois solishtirish bag'rikeng: tartib,
// harf katta-kichikligi, apostrof turi, kirill yozuvi va x/h, q/k almashishi
// farq qilmaydi. Ota-ona «Xasanov»ni «Хасанов» yoki «Hasanov» deb yozsa
// «topilmadi» deyish uni markazga qo'ng'iroq qilishga majburlardi.

/** Solishtirish uchun so'zlar: kichik harf, lotin, apostrofsiz, takrorsiz. */
export function nameWords(raw: string): string[] {
  const folded = normalizeSearch(cyrToLat(raw)).replace(/x/g, "h").replace(/q/g, "k");
  return folded ? [...new Set(folded.split(" "))] : [];
}

/** Ism VA familiya yozilganmi — kamida ikki xil so'z. */
export function isFullName(raw: string): boolean {
  return nameWords(raw).length >= 2;
}

/**
 * Ikki yozuv bitta odammi: biri ikkinchisining ichida to'liq bo'lsa ha.
 *
 * Teng bo'lish TALAB QILINMAYDI: Temuriylar kartalarining yarmida ism ustida
 * otasining ismi ham turibdi ("Vali Karim o'g'li" + "Aliyev"), ota-ona esa
 * "Aliyev Vali" deb yozadi. Bitta so'zi mos kelmasa — boshqa odam.
 */
export function sameName(a: string, b: string): boolean {
  const x = nameWords(a);
  const y = nameWords(b);
  if (x.length === 0 || y.length === 0) return false;
  return x.every((w) => y.includes(w)) || y.every((w) => x.includes(w));
}

/**
 * Shu raqam yozilgan kartalardan ismi mos kelganlari. Raqam kartaning qaysi
 * maydonida turgani farq qilmaydi (`findPupilsByPhone`: o'quvchi, qo'shimcha,
 * ota, ona). Bo'sh ro'yxat — topilmadi.
 */
export async function findPupilsByNameAndPhone(db: Db, name: string, phone: string): Promise<PupilMatch[]> {
  const matches = await findPupilsByPhone(db, phone);
  if (matches.length === 0) return [];
  const names = await loadPupilNames(db, matches.map((m) => m.pupilId));
  return matches.filter((m) => sameName(name, names.get(m.pupilId) ?? ""));
}

const SURNAME_END = /(ov|ova|ev|eva|zoda|iy)$/i;

/**
 * "Vali Aliyev" → ism + familiya. Odam familiyani oldin ham yozadi ("Aliyev
 * Vali", hujjatdagidek), karta esa `firstName lastName` tartibida ko'rsatiladi.
 * Familiya qo'shimchasi faqat birinchi so'zda bo'lsa — o'sha familiya; aks holda
 * oxirgi so'z familiya, qolgani ism.
 */
export function splitPupilName(full: string): { firstName: string; lastName: string } {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { firstName: words[0] ?? "", lastName: "" };
  const head = words[0];
  const tail = words[words.length - 1];
  if (SURNAME_END.test(head) && !SURNAME_END.test(tail)) {
    return { firstName: words.slice(1).join(" "), lastName: head };
  }
  return { firstName: words.slice(0, -1).join(" "), lastName: tail };
}
