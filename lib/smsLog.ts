import type { Db } from "mongodb";
import { nowTime, todayIso } from "@/lib/transactionLog";
import type { SmsKind, SmsPurpose } from "@/lib/smsMessages";
import type { SendSmsResult } from "@/lib/eskiz";
import type { SmsChannel } from "@/lib/smsMessages";

// YUBORILGAN SMS LARNING YAGONA JURNALI (`sms_messages`).
//
// NIMA NOTO'G'RI EDI: `sendSms` loyihada OLTI joydan chaqiriladi, lekin
// jurnalga faqat IKKITASI yozardi (qo'lda yuborish va to'lov SMS i).
// Xodim taklifi, taklifni qayta yuborish va parol tiklash — uchalasi ham
// haqiqiy, PULLIK SMS, lekin ular hech qayerda ko'rinmasdi. Ya'ni
// "SMS analitikasi" sahifasi yarim ma'lumot ko'rsatib, "hammasi shu"
// degan taassurot qoldirardi.
//
// Endi hamma yuboruvchi shu yordamchi orqali yozadi.

/** Xabar matni o'rniga jurnalga tushadigan xavfsiz o'rinbosar. */
const REDACTED = "[matn saqlanmadi — ichida bir martalik kod bor]";

export interface LogSmsInput {
  recipientName: string;
  /** Qaysi kanal. Berilmasa "sms" — eski chaqiruvlar o'zgarmasin. */
  channel?: SmsChannel;
  /** Eskiz formatidagi raqam (998XXXXXXXXX). */
  phone: string;
  text: string;
  purpose: SmsPurpose;
  kind: SmsKind;
  /** Yozuvni qayd etgan xodim. Tizim yuborgan bo'lsa bo'sh. */
  moderator?: string;
  cashboxId?: number;
  cashboxName?: string;
  /**
   * Matn MAXFIYMI. Taklif va parol tiklash SMS larida bir martalik
   * token/kod bor — ular jurnalga TUSHMASLIGI kerak, aks holda Nazorat
   * bo'limi ruxsati bor har kim o'sha kod bilan hisobga kira olardi.
   */
  secret?: boolean;
  result: SendSmsResult;
}

/**
 * Eskiz javobidan xabar ID sini ajratishga urinadi.
 *
 * Javobning ANIQ shakli loyihada hech qachon ochilmagan (`raw` hamma
 * joyda tashlab yuborilardi), shuning uchun bir nechta ehtimolli kalit
 * ko'riladi va topilmasa `null` qaytadi — TAXMIN QILINGAN nom bilan
 * ishlaydigan kod yozilmaydi. To'liq javob `providerRaw` da saqlanadi,
 * ya'ni haqiqiy shakl birinchi yuborishdayoq ma'lum bo'ladi.
 */
export function extractMessageId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const candidates = [o.id, o.message_id, (o.data as Record<string, unknown> | undefined)?.id];
  for (const c of candidates) {
    if (typeof c === "string" && c) return c;
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return null;
}

/**
 * Jurnalga bitta yozuv qo'shadi.
 *
 * HECH QACHON OTMAYDI: jurnal yozuvi SMS yuborishdan ham, uni chaqirgan
 * amaldan ham (to'lov, xodim taklifi) muhimroq emas. Xato bo'lsa
 * konsolga chiqadi va oqim davom etadi.
 */
export async function logSms(db: Db, input: LogSmsInput): Promise<void> {
  try {
    const col = db.collection("sms_messages");
    // `id` ketma-ket — kolleksiyadagi qolgan yozuvlar bilan bir xil qoida.
    const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
    await col.insertOne({
      id: (last[0]?.id ?? 0) + 1,
      recipientName: input.recipientName,
      text: input.secret ? REDACTED : input.text,
      date: todayIso(),
      time: nowTime(),
      moderator: input.moderator ?? "",
      // "Qabul qilindi" = ESKIZ QABUL QILDI. Telefonga yetgani EMAS —
      // buni `deliveryStatus` aytadi va u hozircha doim "unknown".
      status: input.result.ok ? "Qabul qilindi" : "Yuborilmadi",
      kind: input.kind,
      purpose: input.purpose,
      phone: input.phone,
      channel: input.channel ?? "sms",
      ...(input.cashboxId !== undefined ? { cashboxId: input.cashboxId } : {}),
      ...(input.cashboxName ? { cashboxName: input.cashboxName } : {}),
      providerMessageId: extractMessageId(input.result.raw),
      providerRaw: input.result.raw ?? null,
      // NEGA yuborilmagani. Bu bo'lmasa jurnalda faqat "Yuborilmadi"
      // turadi va sabab noma'lum qoladi — eng ko'p uchraydigan sabab esa
      // Eskizda shablon hali tasdiqlanmagani yoki matn tasdiqlangandan
      // farq qilishi. Sababsiz uni topib bo'lmasdi.
      providerError: input.result.ok ? null : (input.result.error ?? null),
      deliveryStatus: "unknown",
      // Eskiz sozlanmagan bo'lsa haqiqiy SMS KETMAYDI (lib/eskiz.ts
      // simulyatsiya rejimi). Buni yashirmaymiz — aks holda analitikada
      // "yuborildi" deb turgan, aslida hech qayerga ketmagan qatorlar
      // paydo bo'lardi.
      simulated: input.result.simulated === true,
    });
  } catch (e) {
    console.error("[smsLog] jurnalga yozilmadi:", e);
  }
}
