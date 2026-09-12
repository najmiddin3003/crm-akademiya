// Boshqaruv → Filiallar (sidebar: Boshqaruv > Filiallar, href
// /management-filiallar). MongoDB `branches` kolleksiyasi.
//
// Nazorat → "Filiallar holati" (lib/branches.ts) bilan aralashtirmang: u
// filiallar bo'yicha METRIKA hisoboti, bu esa filiallarning o'zini
// boshqaradigan ro'yxat (qo'shish/tahrirlash/o'chirish).
export interface ManagementBranch {
  id: number;
  name: string;
  location: string; // o'ngda ko'rinadigan manzil/shahar — bo'sh bo'lishi mumkin
  /**
   * Telegram "Lidlar" guruhidagi SHU FILIALNING topigi (`message_thread_id`).
   * Yangi lid qaysi filialda qo'shilsa, xabar o'sha topikka tushadi
   * (lib/leadNotify.ts). Yo'q bo'lsa — `TELEGRAM_TOPIC_LEADS` (umumiy topik),
   * u ham bo'sh bo'lsa xabar yuborilmaydi.
   *
   * NEGA BAZADA, MUHIT O'ZGARUVCHISIDA EMAS: bu filialning o'z xususiyati —
   * filial qo'shilganda topik ham shu yerda biriktiriladi, serverga kirib
   * .env tahrirlash va qayta ishga tushirish shart emas.
   */
  leadTopicId?: number | null;
  /**
   * To'lovlar guruhidagi SHU FILIALNING topigi — o'quvchi to'lovi (va uning
   * bekor qilinishi) shu yerga tushadi (lib/sync/dispatch.ts). Filial
   * to'lovning KASSASI orqali aniqlanadi (`cashboxes.branchId`), kassir
   * ismi orqali emas. Yo'q bo'lsa — `TELEGRAM_TOPIC_PAYMENTS` (umumiy
   * "To'lovlar" topigi) — ya'ni to'lov hech qachon yo'qolmaydi, faqat
   * umumiy topikka tushadi.
   */
  paymentTopicId?: number | null;
}

/** Filial hujjatidagi Telegram topik maydonlari — API va sahifa shu ro'yxat bo'ylab aylanadi. */
export const BRANCH_TOPIC_FIELDS = ["leadTopicId", "paymentTopicId"] as const;
export type BranchTopicField = (typeof BRANCH_TOPIC_FIELDS)[number];

export type LeadTopicParse = { ok: true; value: number | null } | { ok: false; error: string };

/**
 * Formadan kelgan topik qiymatini tozalaydi.
 *
 * Qabul qilinadi: musbat butun son ("45"), Telegram topik havolasi
 * (`https://t.me/c/2345678901/45` yoki `.../45/120` — o'rtadagi son topik)
 * yoki bo'sh qiymat (topik olib tashlanadi → null).
 *
 * Havola qabul qilinishining sababi: Bot API topiklar ro'yxatini bermaydi,
 * odam topik raqamini eng oson Telegram'dagi "Copy Link" orqali topadi —
 * o'sha havolani to'g'ridan-to'g'ri qo'yib qo'yish raqamni ko'chirib
 * o'tirishdan xatosizroq.
 */
export function parseLeadTopicId(raw: unknown): LeadTopicParse {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const s = String(raw).trim();
  if (!s) return { ok: true, value: null };

  const link = /t\.me\/c\/\d+\/(\d+)/.exec(s);
  const digits = link ? link[1] : s;
  if (!/^\d+$/.test(digits)) {
    return { ok: false, error: "Telegram topigi — musbat butun son yoki topik havolasi bo'lishi kerak" };
  }
  const n = Number(digits);
  if (!Number.isSafeInteger(n)) return { ok: false, error: "Telegram topik raqami juda katta" };
  // 0 — "topik yo'q" degani (Telegram'da topik raqami hech qachon 0 bo'lmaydi).
  return { ok: true, value: n > 0 ? n : null };
}
