import type { Db } from "mongodb";
import { normalizePhone, sendSms } from "@/lib/eskiz";
import { logSms } from "@/lib/smsLog";

// To'lov qabul qilinganda o'quvchiga ketadigan avtomatik SMS.
//
// Matn Eskiz kabinetida TASDIQLANGAN shablon bilan bir xil bo'lishi SHART:
// Eskiz moderatsiyadan o'tmagan matnni rad etadi. Shu bois shablon shu
// yerda, bitta joyda turadi.
//
// NEGA BALANS YO'Q: tizimda o'quvchining QARZDORLIGI yuritilmaydi —
// `/api/students/balances` faqat UMRBOD to'langan pul yig'indisini beradi
// va u hech qachon manfiy bo'lmaydi (o'sha route izohiga qarang). Ya'ni
// "avvalgi balans / hozirgi balans" ni rost qilib yozib bo'lmaydi.
// Markaz bilan kelishildi: SMS balanssiz ketadi. Yon foyda — matn 1 ta
// SMS ga sig'adi (balansli variant 2 ta bo'lardi).
//
// APOSTROF: matnda faqat ODDIY apostrof (') ishlatiladi. Tipografik
// apostrof (U+2019) GSM-7 alifbosida yo'q va butun xabarni UCS-2 ga
// o'tkazadi — bir xil matn 1 o'rniga 4 ta SMS bo'lib, narxi to'rt
// barobar oshadi. O'lchangan.
const CONTACT_PHONE = "+998941118855";

/**
 * SMS yuborish YOQILGANMI.
 *
 * SUKUT BO'YICHA O'CHIQ — ataylab, `SYNC_ENABLED` dan farqli. Sabab:
 * Eskiz moderatsiyadan o'tmagan matnni RAD ETADI, ya'ni shablon
 * tasdiqlanmasidan oldin yoqilsa har to'lovda bekorga urinish bo'lardi
 * va jurnal "Yuborilmadi" bilan to'lardi.
 *
 * Yoqish: Vercel -> Settings -> Environment Variables ->
 *   PAYMENT_SMS_ENABLED=true
 * (o'zgartirgach qayta deploy shart emas — keyingi so'rov o'qiydi.)
 */
export function paymentSmsEnabled(): boolean {
  return process.env.PAYMENT_SMS_ENABLED === "true";
}

/** Eskizdagi tasdiqlangan shablon. */
export function paymentSmsText(pupilName: string, amount: number): string {
  return `Assalomu alaykum ${pupilName}. Akademiya markaziga ${groupSom(amount)} so'm to'lovingiz qabul qilindi. Rahmat! Murojaat: ${CONTACT_PHONE}`;
}

/** 1500000 -> "1 500 000" */
function groupSom(n: number): string {
  return Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export interface PaymentSmsInput {
  /**
   * Tanlangan o'quvchining ID si — Kirim oynasidan keladi.
   *
   * ISM BO'YICHA QIDIRISH YARAMAYDI va bu o'lchangan: bazada 511 ta ism
   * takrorlanadi (1 108 o'quvchi, 16.3%), ularning 501 tasida TELEFON
   * HAR XIL. Mavjud to'lovlarning 27% i aynan shunday ismga tegadi.
   * Ya'ni ism bo'yicha topilgan telefon har to'rtinchi to'lovda BEGONA
   * odamniki bo'lishi mumkin edi — bu shunchaki xato emas, maxfiylik
   * buzilishi (xabarda to'lov summasi bor).
   */
  pupilId: number | null;
  pupilName: string;
  amount: number;
  /** Yozuvni qayd etgan kassir — SMS jurnalida ko'rinadi. */
  moderator: string;
  /** Qaysi kassadan — SMS analitikasi shu bo'yicha ham guruhlaydi. */
  cashboxId: number;
  cashboxName: string;
}

/**
 * To'lov SMS ini yuboradi va natijani `sms_messages` jurnaliga yozadi
 * (Sotuv va marketing -> Xabarlar ro'yhati, "Avto sms" tabi).
 *
 * HECH QACHON OTMAYDI. Bu funksiya `after()` ichida, to'lov allaqachon
 * yozilgandan keyin chaqiriladi — bu yerdagi xato pulga tegmasligi
 * kerak. Nima bo'lganda ham jurnalga yozuv qoladi, ya'ni yuborilmagan
 * SMS jim yo'qolmaydi.
 */
export async function sendPaymentSms(db: Db, input: PaymentSmsInput): Promise<void> {
  const text = paymentSmsText(input.pupilName, input.amount);

  const common = {
    recipientName: input.pupilName,
    text,
    purpose: "payment" as const,
    kind: "auto" as const,
    moderator: input.moderator,
    cashboxId: input.cashboxId,
    cashboxName: input.cashboxName,
  };

  let phone = "";
  try {
    phone = await pupilPhone(db, input.pupilId);
  } catch (e) {
    console.error("[paymentSms] telefon topilmadi:", e);
  }

  if (!phone) {
    // Telefonsiz o'quvchi (bazada 6 ta) yoki id kelmagan holat.
    // Jurnalga yozib qo'yamiz, jim o'tkazib yubormaymiz.
    await logSms(db, {
      ...common,
      phone: "",
      result: { ok: false, error: "O'quvchining telefon raqami yo'q" },
    });
    return;
  }

  const res = await sendSms(phone, text).catch((e) => ({
    ok: false as const,
    error: e instanceof Error ? e.message : String(e),
  }));
  if (!res.ok) console.error("[paymentSms] Eskiz xato:", res.error);

  await logSms(db, { ...common, phone: normalizePhone(phone), result: res });
}

async function pupilPhone(db: Db, pupilId: number | null): Promise<string> {
  if (pupilId === null || !Number.isFinite(pupilId)) return "";
  const p = await db.collection("pupils").findOne(
    { id: pupilId },
    { projection: { _id: 0, phone: 1 } },
  );
  return typeof p?.phone === "string" ? p.phone.trim() : "";
}
