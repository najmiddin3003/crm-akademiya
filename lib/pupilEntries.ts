import type { Db, Document } from "mongodb";
import { pupilFullName } from "@/lib/pupilsData";

// O'QUVCHI ↔ TO'LOV BOG'LANISHI — yagona qoida, butun server shu yerdan
// o'qiydi.
//
// MUAMMO (foydalanuvchi, 23.09.2026): "o'quvchilarni ajratishda ism
// familiyaga qarab ajratyapti, bitta ism familiyaga qilingan to'lov
// ikkinchi shunday ism familiyalik o'quvchiga ham tushyapti".
//
// Shunday edi: `transaction_entries` yozuvida o'quvchining raqamli id'si
// YO'Q edi, faqat `studentName` satri. Bazada 545 ta ism takrorlanadi va
// ularga 1 193 o'quvchi tegishli — ya'ni ismdoshlar bir-birining pulini
// ko'rardi. Bu shunchaki jadvaldagi noqulaylik emas:
//
//   • profil balansi va "Tranzaksiyalar tarixi" — ikkalasi ham begona
//     to'lovni qo'shib ko'rsatardi;
//   • qarzdorlik hisobi (/reports-unpaid) — to'lagan deb hisoblardi;
//   • o'quvchiga pul qaytarishda balans chegarasi — ismdoshning puli
//     hisobiga ruxsat berardi;
//   • o'quvchilar boti — bolaga BEGONA odamning to'lovlarini ko'rsatardi.
//
// YECHIM: yozuvga `pupilId` qo'shildi (lib/transactionEntries.ts) va
// bog'lanish shu bo'yicha ketadi. Ism yozuvda QOLADI — jurnal, Sheets va
// Telegram xabarlari uni ko'rsatadi — lekin endi u kalit emas, ko'rsatma.
//
// ESKI YOZUVLAR. Bazadagi yozuvlarning ko'pida `pupilId` yo'q va uni
// kunning o'zida hammasiga qo'yib bo'lmaydi (ismi takrorlangan eskilarida
// qaysi o'quvchi ekani ma'lum emas). Shuning uchun qoida IKKI QAVATLI:
//
//   `pupilId` BOR yozuv    → FAQAT o'sha o'quvchiniki. Ismdoshga hech
//                            qachon ko'rinmaydi.
//   `pupilId` YO'Q yozuv   → eskicha, ism bo'yicha topiladi.
//
// Ya'ni bugundan boshlab yozilgan har bir to'lov to'g'ri egasida turadi,
// eski yozuvlar esa bugungidek ishlayveradi (yomonlashmaydi).
// `scripts/backfill-entry-pupil-id.mjs` eskilarini ham belgilaydi: ismi
// yagona bo'lsa to'g'ridan-to'g'ri, takrorlansa qo'shimcha belgilar
// (ustoz, telefon, filial) bo'yicha; hech biri yordam bermasa yozuv
// belgilanmasdan qoladi — taxmin qilinmaydi.

/** Foydalanuvchi kiritgan matnni $regex ichiga xavfsiz qo'yish uchun. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Ism bo'yicha AYNAN moslik — katta-kichik harf va chetdagi bo'shliqqa
 * befarq.
 *
 * Chetdagi `\s*` SHART, ortiqcha ehtiyotkorlik emas: yozuvlar turli
 * oqimlardan keladi (kassa oynasi, bot, import skriptlari) va bazada
 * chetida probel bor ismlar bor. Balans hisobi ham xuddi shu qoidada
 * (`trim().toLowerCase()`) guruhlaydi, ya'ni ikkala yo'l bir xil
 * qatorlarni ko'rsin.
 */
export function nameEq(name: string): { $regex: string; $options: string } {
  return { $regex: `^\\s*${escapeRegex(name.trim())}\\s*$`, $options: "i" };
}

/** O'quvchi — id va (zaxira yo'l uchun) to'liq ismi. */
export interface PupilRef {
  id: number;
  name: string;
}

/**
 * Mongo shart obyekti. Loyihadagi kolleksiyalar tiplanmagan
 * (`db.collection("transaction_entries")` → `Document`), shuning uchun
 * `Filter<TransactionEntry>` qaytarilsa har bir chaqiruv joyida tip
 * mos kelmay qolardi.
 */
export type EntryFilter = Record<string, unknown>;

/**
 * `pupils` hujjatidan to'liq ism. Bazada `name` maydoni YO'Q —
 * `firstName` + `lastName`, va hujjat tiplanmagan holda keladi, shuning
 * uchun keltirish BITTA joyda turadi.
 */
export function pupilNameOfDoc(doc: Document | null | undefined): string {
  return pupilFullName({
    firstName: String(doc?.firstName ?? ""),
    lastName: String(doc?.lastName ?? ""),
  });
}

/**
 * BITTA o'quvchining jurnal yozuvlari sharti.
 *
 * Yuqoridagi ikki qavatli qoidaning o'zi:
 *   • `pupilId` shu o'quvchiga teng bo'lgan yozuvlar; VA
 *   • `pupilId` umuman yo'q, lekin ismi mos kelgan ESKI yozuvlar.
 *
 * Ikkinchi shoxdagi `pupilId: { $exists: false }` ENG MUHIM QISM — usiz
 * ismdoshning belgilangan to'lovi ham ism bo'yicha qaytib kelardi va
 * butun o'zgarish bekorga ketardi.
 */
export function pupilEntryMatch(ref: PupilRef): EntryFilter {
  const name = String(ref.name ?? "").trim();
  const byId = { pupilId: ref.id };
  if (!name) return byId;
  return { $or: [byId, { pupilId: { $exists: false }, studentName: nameEq(name) }] };
}

/**
 * O'quvchining BALANSINI tashkil qiluvchi yozuvlar sharti — to'lovlar
 * (payIn) va unga qaytarib berilgan pul (payOut + `studentRefund`),
 * bekor qilinganlarsiz.
 *
 * `studentBalanceMatch()` (lib/studentRefund.ts) bilan bir xil to'plam,
 * faqat BITTA o'quvchiga kesilgan. Shart o'sha yerdan olinadi — ikki
 * joyda ikki xil balans chiqmasin.
 */
export function pupilBalanceMatch(ref: PupilRef, base: EntryFilter): EntryFilter {
  // `base` ning o'zida ham `$or` bor (payIn / qaytarim), shu bois ikkalasi
  // `$and` bilan birlashtiriladi — bitta obyektga qo'shilsa biri
  // ikkinchisini JIMGINA bosib ketardi.
  return { $and: [base, pupilEntryMatch(ref)] };
}

/**
 * Yozuvga YOZILADIGAN `pupilId` ni aniqlaydi.
 *
 * Kassa oynasi va bot o'quvchini id bilan yuboradi — u shunchaki
 * tekshiriladi (bazada bormi). Id yuborilmagan holatlar ham bor (eski
 * mijoz, skript, "Chiqim" oynasining eski oqimi), o'shanda ISMga
 * qaytiladi va FAQAT ism YAGONA bo'lsa id topiladi.
 *
 * Ism takrorlansa `null` qaytadi — TAXMIN QILINMAYDI. "Birinchisini
 * olaylik" degan qoida aynan tuzatilayotgan xatoni qaytarardi, faqat bu
 * safar jimroq: yozuv notog'ri o'quvchiga MUHRLANIB qolardi va uni
 * keyinchalik ajratib bo'lmasdi. Belgilanmagan yozuv esa eskicha
 * ishlaydi.
 */
export async function resolvePupilRef(
  db: Db,
  input: { id?: number | null; name?: string | null },
): Promise<PupilRef | null> {
  const wantedId = Number(input.id);
  if (Number.isFinite(wantedId)) {
    const p = await db
      .collection("pupils")
      .findOne({ id: wantedId }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } });
    if (p) return { id: Number(p.id), name: pupilNameOfDoc(p) };
    // Id bor, lekin bunday o'quvchi yo'q (o'chirilgan yoki mijozdagi
    // eskirgan ro'yxat) — ismga qaytamiz, pastdagi shox hal qiladi.
  }

  const name = String(input.name ?? "").trim();
  if (!name) return null;
  // Ism bo'yicha qidiruv — bazada `name` maydoni YO'Q (`firstName` +
  // `lastName`), shuning uchun taqqoslash JS'da. Ro'yxat yengil
  // (id + ism), 7 130 hujjat.
  const rows = await db
    .collection("pupils")
    .find({}, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } })
    .toArray();
  const wanted = name.toLowerCase();
  const hits = rows.filter((p) => pupilNameOfDoc(p).toLowerCase() === wanted);
  if (hits.length !== 1) return null;
  return { id: Number(hits[0].id), name: pupilNameOfDoc(hits[0]) };
}
