import { cookies } from "next/headers";
import { normalizeLang, translate, type Lang, type TParams } from "@/lib/i18n";

// SERVER komponentlar uchun tarjimon — `useT()` hook'i u yerda ishlamaydi.
// Til components/shared/Language.tsx yozadigan cookie'dan o'qiladi
// (app/layout.tsx `<html lang>` uchun ham shu cookie). Matn deyarli
// to'liq klient komponentlarda; bu faqat bir-ikki sahifa qobig'i uchun
// (app/(app)/home, student-edit) — ular `cookies()` tufayli baribir dinamik.
export const LANG_COOKIE = "tizimli_lang";

export async function getServerT(): Promise<{ t: (key: string, params?: TParams) => string; lang: Lang }> {
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  return { t: (key, params) => translate(lang, key, params), lang };
}
