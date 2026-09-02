// Tanlov (select) maydonining birinchi qatoridagi matn.
//
// NIMA UCHUN ALOHIDA FUNKSIYA: loyihada backenddan to'ladigan 60 dan ortiq
// tanlov bor. Har birida matn qo'lda yozilsa, muqarrar ravishda
// "Yuklanmoqda...", "Yuklanyapti", "Kuting" kabi turlicha variantlar paydo
// bo'ladi — bitta ekranda ikki xil yozuv turadi.
//
// ASOSIY QOIDA: ma'lumot KELAYOTGAN paytda bo'sh-holat xabari YOZILMAYDI.
// "Filial qo'shilmagan", "Boshqa kassa yo'q", "Moderator yo'q", "Topilmadi"
// — bularning hammasi o'sha onda YOLG'ON, chunki hali hech narsa
// o'qilmagan. Foydalanuvchi buni "ro'yxat bo'sh ekan" deb tushunadi va
// sozlamalarni tekshirgani ketadi.

/** Yuklanish matni — HAMMA joyda AYNAN shu (bitta uch-nuqta belgisi). */
export const LOADING_TEXT = "Yuklanmoqda…";

/**
 * Nativ `<select>` ning birinchi `<option>` matni.
 *
 * Nativ select ichiga DOM element (spinner) chizib bo'lmaydi, shuning
 * uchun bu yerda faqat MATN o'zgaradi. Qidiruvli dropdownlarda esa
 * `SpinnerBlock` ishlatiladi (StudentSearchSelect, ui/Select).
 *
 *     <option value="">
 *       {selectPlaceholder(teachersLoading, teacherNames.length, "O'qituvchi qo'shilmagan")}
 *     </option>
 *
 * @param loading Manba hali yuklanayotganmi.
 * @param count   Ro'yxatdagi element soni.
 * @param empty   Ro'yxat HAQIQATAN bo'sh bo'lgandagi matn.
 * @param ready   Ro'yxat tayyor bo'lgandagi matn (sukut — "Tanlang").
 */
export function selectPlaceholder(
  loading: boolean | undefined,
  count: number,
  empty: string,
  ready = "Tanlang",
): string {
  if (loading) return LOADING_TEXT;
  return count === 0 ? empty : ready;
}
