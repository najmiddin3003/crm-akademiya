// IKKI BOSQICHLI KIRISH — parol yetarli emas, admin ham tasdiqlaydi.
//
// Oqim: admin faollashtirish SMS'ini "Ikki bosqichli tasdiqlash" yoqiq
// holda yuboradi → xodim havoladan o'tib PAROL QO'YADI (hisob `active`
// bo'ladi) → lekin TIZIMGA KIRA OLMAYDI: ruxsat kutib turadi → admin
// "Vaqtinchalik" sahifasida ✓ bosgach kiradi (✗ bosilsa kirmaydi).
//
// NEGA `users.status` GA YANGI QIYMAT QO'SHILMADI: `status` faollashtirish
// oqimining o'zi bilan bog'langan (`invited` → `active`) va uni o'nlab joy
// o'qiydi — "kutmoqda" degan to'rtinchi qiymat faollashtirishni ham,
// "Aktiv qurilmalar"ni ham, oylik ro'yxatini ham buzardi. Tasdiq ALOHIDA
// o'lchov, shu bois alohida maydon.
//
// MAYDON YO'Q = TEKSHIRUV YO'Q. Mavjud hamma hisob shu sababli avvalgidek
// ishlaydi: ikki bosqich faqat ONGLI ravishda yoqilgan xodimga tegadi.

/** `users.adminApproval` qiymatlari. Maydon yo'q — talab qilinmagan. */
export type AdminApproval = "pending" | "approved" | "rejected";

export const APPROVAL_FIELD = "adminApproval";

/** Kirishga to'sqinlik qiladigan holatlar. */
export function approvalBlocks(value: unknown): value is "pending" | "rejected" {
  return value === "pending" || value === "rejected";
}

/**
 * Xodimga ko'rsatiladigan sabab.
 *
 * "Telefon raqam yoki parol noto'g'ri" DEB AYTILMAYDI: parol to'g'ri va
 * odam uni qayta-qayta terib, o'zini aybdor his qilib o'tirardi. Bu
 * yerda sir yo'q — hisob bor, faqat ruxsat kutilmoqda.
 */
export function approvalError(value: unknown): string {
  return value === "rejected"
    ? "Kirish rad etilgan. Administratorga murojaat qiling."
    : "Hisobingiz admin tasdiqlashini kutmoqda. Tasdiqlangach kirishingiz mumkin.";
}
