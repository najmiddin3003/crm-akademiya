import type { Db } from "mongodb";

// «SAHIFA OCHIQ» — ommaviy so'rovnomani (/sorovnoma) vaqtincha yopish (yangi versiya
// Sozlamalar → Lidlar → So'rovnoma sahifasi, 24-qism, 13.11.2026).
//
// NEGA LID SOZLAMALARIDAN ALOHIDA: `sale-marketing.leads` ni eski Lidlar tabi
// (components/settings/LeadSettingsTab.tsx) BUTUNICHA qayta yozadi va
// normalizeLeadSettings notanish maydonni tashlab yuboradi — bayroq u yerda tursa,
// eski tabda bir marta «Saqlash» bosilishi sahifani jimgina qayta ochib yuborardi.
//
// SUKUT — OCHIQ: hujjat yo'q yoki `open` false emas. Yopiq bo'lsa sahifa «So'rovnoma
// vaqtincha yopiq» ni ko'rsatadi (app/sorovnoma/page.tsx), qabul route'i yangi lid
// yozmaydi (app/api/sorovnoma/route.ts). Telegram botdagi «Kursga yozilish» bunga
// bog'liq EMAS — u o'z kanali (lib/studentBot/signup.ts).

export const SURVEY_PAGE_KEY = "sorovnoma.page";

export async function loadSurveyOpen(db: Db): Promise<boolean> {
  const doc = await db.collection("settings").findOne({ key: SURVEY_PAGE_KEY }, { projection: { _id: 0, values: 1 } });
  const v = doc?.values as { open?: unknown } | undefined;
  return v?.open !== false;
}

export async function saveSurveyOpen(db: Db, open: boolean, by: string): Promise<void> {
  await db
    .collection("settings")
    .updateOne({ key: SURVEY_PAGE_KEY }, { $set: { key: SURVEY_PAGE_KEY, values: { open, by, at: new Date() } } }, { upsert: true });
}
