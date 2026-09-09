import type { Db } from "mongodb";
import type { Pupil } from "@/lib/pupilsData";

// TELEFON RAQAM bo'yicha o'quvchini topish — botga kirishning yagona yo'li.
//
// NEGA TELEFON. Telegram `request_contact` tugmasi bosilganda raqamni
// FOYDALANUVCHINING O'ZI EMAS, Telegram yuboradi va u hisobga bog'langan,
// SMS bilan tasdiqlangan raqam. Ya'ni "men falonchiman" deb yozib boshqa
// o'quvchining balansini ko'rib bo'lmaydi. Parol tarqatish esa 6 732
// o'quvchi uchun amalda imkonsiz edi.
//
// NEGA OTA-ONA RAQAMI HAM. Markaz bilan kelishildi: o'quvchilarning
// katta qismi maktab yoshida va telefon ota-onasida. Faqat `phone` bilan
// cheklansa ular botdan umuman foydalana olmasdi. Bitta raqamga bir
// nechta farzand bog'langan bo'lishi mumkin — bot ular orasidan
// tanlashni so'raydi.

/** Qaysi maydon mos kelgani — salomlashish matni shunga qarab o'zgaradi. */
export type MatchRole = "student" | "parent";

export interface PupilMatch {
  pupilId: number;
  role: MatchRole;
}

/**
 * Raqamning SOLISHTIRISH KALITI — oxirgi 9 raqam.
 *
 * Bazada raqam bir necha xil ko'rinishda yotibdi: "94 111 88 55",
 * "+998951283938", "901234567". Telegram esa "998901234567" beradi.
 * Hammasini bitta shaklga keltirmasa solishtirib bo'lmaydi.
 *
 * `null` — 9 raqamdan kam, ya'ni O'zbekiston raqami emas yoki chala
 * yozilgan. Bunday qiymat bilan qidirish MUMKIN EMAS: qisqa kalit
 * o'nlab begona raqamga mos kelib, boshqa odamning ma'lumotini ochib
 * qo'yardi.
 */
export function phoneKey(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}

/** Ko'rsatish uchun: "94 111 88 55". Kalit yaroqsiz bo'lsa xom qiymat. */
export function formatPhone(raw: unknown): string {
  const key = phoneKey(raw);
  if (!key) return String(raw ?? "");
  return `${key.slice(0, 2)} ${key.slice(2, 5)} ${key.slice(5, 7)} ${key.slice(7)}`;
}

/**
 * Ajratkichga chidamli Mongo naqshi: "941118855" ->
 * /9[^0-9]*4[^0-9]*1...5$/ — bo'shliq, qavs va chiziqchalar to'smaydi.
 *
 * OXIRIGA bog'lanadi ($), boshiga YO'Q: shunda "+998 94 111 88 55" ham,
 * "941118855" ham topiladi. Faqat raqamlardan iborat, ya'ni regexp
 * belgilarini eskeyplash shart emas.
 */
function tailPattern(key: string): string {
  return `${key.split("").join("[^0-9]*")}$`;
}

/**
 * Bitta raqamga bog'lanadigan eng ko'p o'quvchi.
 *
 * O'lchandi (09.09.2026, 6 950 o'quvchi): 40 ta raqam takrorlanadi va
 * eng ko'pi 3 ta o'quvchida — ya'ni aka-uka/opa-singil, tabiiy hol.
 * Chegara BUGUNGI ma'lumot uchun emas, ERTANGI xato uchun: kimdir
 * importda yoki qo'lda markazning umumiy raqamini yuzlab yozuvga yozib
 * qo'ysa, o'sha raqam egasi hammaning to'lov tarixini ochib ko'rardi.
 * Bunday holatda bog'lanish UMUMAN berilmaydi — yarmini ko'rsatish
 * xatoni yashirardi, o'quvchi esa nega ba'zilari yo'qligini bilmasdi.
 */
const MAX_LINKS = 10;

/** O'quvchining O'Z raqamlari — bular "student" roli beradi. */
const OWN_FIELDS = ["phone", "extraPhone"] as const;
/** Ota-ona raqamlari — "parent" roli. */
const PARENT_FIELDS = ["fatherPhone", "motherPhone"] as const;

type PhoneDoc = Pick<Pupil, "id" | "phone" | "extraPhone" | "fatherPhone" | "motherPhone" | "status">;

/**
 * Shu raqamga bog'langan barcha o'quvchilar.
 *
 * TO'LIQ SKANER, ATAYLAB. `pupils` da telefon bo'yicha indeks yo'q va
 * qo'shilmadi ham: qidiruv FAQAT botga kirishda, o'quvchi uchun bir
 * marta ishlaydi (keyin bog'lanish `student_bot_users` da saqlanadi).
 * 6 732 hujjatda bu ~o'n millisekund; indeks esa naqsh oxiriga
 * bog'langani uchun baribir ishlamas edi — bazadagi raqamlar bir xil
 * shaklda saqlanmaydi.
 *
 * ARXIVDAGI O'QUVCHI HAM QAYTADI: o'qishni tugatgan odam ham o'z
 * to'lov tarixini ko'rishi tabiiy. Chegara yuqorida — `status` bilan
 * birga qaytadi va chaqiruvchi kerak bo'lsa ajratadi.
 */
export async function findPupilsByPhone(db: Db, rawPhone: string): Promise<PupilMatch[]> {
  const key = phoneKey(rawPhone);
  if (!key) return [];

  const rx = { $regex: tailPattern(key) };
  const rows = (await db
    .collection("pupils")
    .find(
      { $or: [...OWN_FIELDS, ...PARENT_FIELDS].map((f) => ({ [f]: rx })) },
      { projection: { _id: 0, id: 1, phone: 1, extraPhone: 1, fatherPhone: 1, motherPhone: 1, status: 1 } },
    )
    .toArray()) as unknown as PhoneDoc[];

  const out: PupilMatch[] = [];
  for (const row of rows) {
    if (typeof row.id !== "number") continue;
    // Rol JS'da qayta aniqlanadi: Mongo qaysi shart ishlaganini aytmaydi,
    // va bitta raqam ikkala maydonda ham turishi mumkin (o'quvchining
    // o'zi ham, otasi ham shu raqamni ko'rsatgan). Bunday holatda
    // "student" ustun — u o'z ma'lumotini ko'ryapti.
    const own = OWN_FIELDS.some((f) => phoneKey(row[f]) === key);
    const parent = PARENT_FIELDS.some((f) => phoneKey(row[f]) === key);
    if (!own && !parent) continue; // naqsh mos kelgan, kalit esa yo'q — tashlanadi
    out.push({ pupilId: row.id, role: own ? "student" : "parent" });
  }
  if (out.length > MAX_LINKS) {
    console.error(
      `[student-bot] ${key} raqami ${out.length} ta o'quvchiga bog'langan — bog'lanish berilmadi (MAX_LINKS=${MAX_LINKS})`,
    );
    return [];
  }

  // Barqaror tartib: ro'yxatdagi tugmalar har safar bir xil joyda tursin.
  return out.sort((a, b) => a.pupilId - b.pupilId);
}
