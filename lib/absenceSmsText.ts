// OTA-ONAGA «DARSGA KELMADI» SMS — MATN QISMI (27.11.2026, Akademiya'da ishlamaydi).
// Yuborish, navbat va jurnal — lib/absenceSms.ts. Bu faylda tashqi import YO'Q:
// sof funksiyalar, `node` bilan to'g'ridan-to'g'ri sinab ko'rsa bo'ladi.
//
// ESKIZ SHABLONI: matn Eskiz'da tasdiqlangan shablonga AYNAN mos bo'lishi shart,
// aks holda Eskiz rad etadi (400). O'zgaruvchilar — {#...#}. Shablonni o'zgartirsangiz,
// Eskiz'da ham yangisini tasdiqlatish kerak.
//
// BITTA SMS: lotin harflari va oddiy apostrof (') bilan matn GSM-7 — 160 belgi bitta
// SMS. Bitta «‘» yoki «’» butun matnni UCS-2 ga o'tkazadi (70 belgi) — shuning uchun
// ism-familiyalardagi har xil apostroflar ' ga keltiriladi. Qiymatlar uzun bo'lsa
// matn bosqichma-bosqich qisqartiriladi (fitAbsenceText), shablon o'zgarmaydi.

export const ABSENCE_SMS_TEMPLATE =
  "Hurmatli {#ota_ona_ismi#}! Farzandingiz {#oquvchi#} {#sana#} kuni {#fan#} darsiga kelmadi. Iltimos, e'tibor qarating. {#markaz#} {#markaz_raqam#}";

export interface AbsenceSmsValues {
  ota_ona_ismi: string;
  oquvchi: string;
  sana: string;
  fan: string;
  markaz: string;
  markaz_raqam: string;
}

// ── SMS uzunligi ─────────────────────────────────────────────────────────
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";

export interface SmsSize {
  encoding: "GSM-7" | "UCS-2";
  /** Belgilar soni (GSM-7 da kengaytma belgilar 2 tadan). */
  length: number;
  /** Necha SMS bo'lib ketadi. */
  parts: number;
}

export function smsSize(text: string): SmsSize {
  let n = 0;
  for (const ch of text) {
    if (GSM7.includes(ch)) n += 1;
    else if (GSM7_EXT.includes(ch)) n += 2;
    else {
      const u = [...text].length;
      return { encoding: "UCS-2", length: u, parts: u <= 70 ? 1 : Math.ceil(u / 67) };
    }
  }
  return { encoding: "GSM-7", length: n, parts: n <= 160 ? 1 : Math.ceil(n / 153) };
}

// ── Qiymatlarni tozalash ─────────────────────────────────────────────────
/** Har xil apostroflar → oddiy ' ; ortiqcha bo'shliqlar va shablon belgilari olib tashlanadi. */
export function smsClean(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/[ʻʼ‘’‛`´ʹ`]/g, "'")
    .replace(/[{}#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** «OLIMOV» / «dilorom» → «Olimov» / «Dilorom»; aralash yozuv («McKay») o'zgarmaydi. */
function fixCase(word: string): string {
  if (word.length < 2) return word.toUpperCase();
  const lower = word.toLowerCase();
  if (word !== word.toUpperCase() && word !== lower) return word;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const PATRONYMIC = /^(o'g'li|o'gli|ogli|ug'li|ugli|qizi|kizi)$|(ovich|evich|ovna|evna)$/i;
const SURNAME = /(ov|ova|ev|eva|yev|yeva)$/i;

function words(name: string | null | undefined): string[] {
  return smsClean(name).split(" ").filter(Boolean).map(fixCase);
}

/** Ota-ona: «Familiya Ism» (otasining ismi tashlanadi) — «Yo'ldasheva Madina Bahodir qizi» → «Yo'ldasheva Madina». */
export function parentFullName(name: string | null | undefined): string {
  const w = words(name).filter((x, i) => i === 0 || !PATRONYMIC.test(x));
  return w.slice(0, 2).join(" ");
}

/** Ota-onaning faqat ismi — familiyaga o'xshamagan birinchi so'z («Yo'ldasheva Madina» → «Madina»). */
export function parentGivenName(name: string | null | undefined): string {
  const w = words(name).filter((x) => !PATRONYMIC.test(x));
  return w.find((x) => !SURNAME.test(x)) ?? w[1] ?? w[0] ?? "";
}

/** O'quvchi — faqat ismi (firstName ning birinchi so'zi; bo'sh bo'lsa familiyasi). */
export function pupilGivenName(firstName: string | null | undefined, lastName?: string | null): string {
  return words(firstName)[0] ?? words(lastName)[0] ?? "";
}

/** "2026-11-27" → "27.11.2026" (yoki yilsiz "27.11"). */
export function smsDate(iso: string, withYear = true): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return withYear ? `${m[3]}.${m[2]}.${m[1]}` : `${m[3]}.${m[2]}`;
}

export function renderAbsenceSms(v: AbsenceSmsValues): string {
  return ABSENCE_SMS_TEMPLATE.replace(/\{#(\w+)#\}/g, (_, k: string) => smsClean((v as unknown as Record<string, string>)[k]));
}

export interface AbsenceSmsInput {
  /** Ota/ona ismi (bazadagicha); bo'sh — «ota-ona». */
  parentName: string;
  pupilFirstName: string;
  pupilLastName: string;
  /** Dars sanasi "YYYY-MM-DD". */
  date: string;
  /** Fan (guruh kursi). */
  subject: string;
  centerName: string;
  centerShort: string;
  centerPhone: string;
}

export interface AbsenceSmsText {
  text: string;
  size: SmsSize;
  /** Nechanchi qisqartirish bosqichida sig'di (0 — to'liq qiymatlar). */
  step: number;
}

/**
 * Matnni BITTA SMS ga sig'diradi. Bosqichlar (birinchi sig'gani olinadi):
 *   0 — «Familiya Ism», to'liq sana, markazning to'liq nomi;
 *   1 — markazning qisqa nomi (NEXT_PUBLIC_CENTER_SHORT);
 *   2 — sana yilsiz («27.11»);
 *   3 — ota-onaning faqat ismi;
 *   4 — fan nomi kesiladi.
 * Hech biri sig'masa (masalan, kirill harfi — UCS-2) oxirgisi qaytadi: SMS baribir
 * ketadi, faqat ikki qism bo'ladi — xabarsiz qolgandan yaxshi.
 */
export function fitAbsenceText(i: AbsenceSmsInput): AbsenceSmsText {
  const fullParent = parentFullName(i.parentName) || "ota-ona";
  const givenParent = parentGivenName(i.parentName) || "ota-ona";
  const base: AbsenceSmsValues = {
    ota_ona_ismi: fullParent,
    oquvchi: pupilGivenName(i.pupilFirstName, i.pupilLastName),
    sana: smsDate(i.date),
    fan: smsClean(i.subject),
    markaz: smsClean(i.centerName),
    markaz_raqam: smsClean(i.centerPhone).replace(/\s/g, ""),
  };
  const short = smsClean(i.centerShort) || base.markaz;
  const steps: AbsenceSmsValues[] = [
    base,
    { ...base, markaz: short },
    { ...base, markaz: short, sana: smsDate(i.date, false) },
    { ...base, markaz: short, sana: smsDate(i.date, false), ota_ona_ismi: givenParent },
  ];
  let last: AbsenceSmsText | null = null;
  for (let step = 0; step < steps.length; step++) {
    const text = renderAbsenceSms(steps[step]);
    const size = smsSize(text);
    last = { text, size, step };
    if (size.parts === 1) return last;
  }
  // 4 — fan nomini sig'guncha kesish (GSM-7 da; UCS-2 da kesish ma'nosiz).
  const v = steps[steps.length - 1];
  if (last && last.size.encoding === "GSM-7") {
    const over = last.size.length - 160;
    const subj = v.fan.slice(0, Math.max(3, v.fan.length - over)).trim();
    const text = renderAbsenceSms({ ...v, fan: subj });
    return { text, size: smsSize(text), step: 4 };
  }
  return last!;
}

/** Raqam 998XXXXXXXXX ko'rinishida (lib/eskiz.ts normalizePhone bilan bir xil qoida). */
export function smsPhone(input: string | null | undefined): string | null {
  const d = String(input ?? "").replace(/\D/g, "");
  let n = d;
  if (d.length === 9) n = "998" + d;
  else if (d.length === 13 && d.startsWith("998")) n = d.slice(0, 12);
  return /^998\d{9}$/.test(n) ? n : null;
}

export interface ParentRecipient {
  /** "Ota" | "Ona" | "Ota-ona" (ikkalasining raqami bir xil bo'lsa). */
  kind: "Ota" | "Ona" | "Ota-ona";
  /** Murojaat uchun ism; bo'sh — matnda «ota-ona». */
  name: string;
  phone: string;
}

/**
 * Kimga yuboriladi: raqami bor ota va ona (ikkalasi ham). Raqami bir xil bo'lsa —
 * bitta SMS, murojaat «ota-ona». Noto'g'ri raqam tashlab ketiladi.
 */
export function parentRecipients(p: {
  fatherName?: string | null;
  fatherPhone?: string | null;
  motherName?: string | null;
  motherPhone?: string | null;
}): ParentRecipient[] {
  const out: ParentRecipient[] = [];
  const add = (kind: "Ota" | "Ona", name: string | null | undefined, phone: string | null | undefined) => {
    const n = smsPhone(phone);
    if (!n) return;
    const same = out.find((r) => r.phone === n);
    if (same) {
      same.kind = "Ota-ona";
      same.name = "";
      return;
    }
    out.push({ kind, name: smsClean(name), phone: n });
  };
  add("Ota", p.fatherName, p.fatherPhone);
  add("Ona", p.motherName, p.motherPhone);
  return out;
}
