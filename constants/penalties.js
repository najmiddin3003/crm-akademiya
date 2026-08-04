// Moliya → Jarima. Bonus bilan bir xil "Tranzaksiya turi" mexanizmi (qaysi
// tanlansa pastda Xodim yoki O'quvchi maydoni chiqadi) — lekin ro'yxat
// jadvalida bu tur ustuni ko'rsatilmaydi (manba skrinshotida yo'q).
export const PENALTY_TYPES = [
  { value: "employee", label: "Xodimga jarima" },
  { value: "student", label: "O'quv markaz hisobidan" },
];

// "Bekor qilish" tasdiqlash oynasidagi "Sababi" tanlovi — manba skrinshotida
// ro'yxat ochiq holda ko'rsatilmagan, shuning uchun odatiy sabablar bilan
// to'ldirilgan (kerak bo'lsa keyin aniqlashtirish mumkin).
export const PENALTY_CANCEL_REASONS = [
  "Xato kiritilgan",
  "Noto'g'ri hisoblangan",
  "Kelishilgan holda bekor qilindi",
  "Boshqa sabab",
];

// id:1 avval yaratilgan (eski, hali bekor qilinmagan) — id:2 undan keyin
// yaratilgan va uning "keyingi miqdor"idan davom etadi, keyin bekor qilingan
// (ro'yxat _id bo'yicha kamayish tartibida chiqqani uchun id:2 EKRANDA
// birinchi qatorda, id:1 ikkinchi qatorda ko'rinadi — skrinshot shu tartibda).
export const PENALTY_SEED = [
  { id: 1, type: "employee", cashboxId: null, recipientName: "Abdulloh Raxmatullayev", before: -42391000, amount: 1, after: -42391001, note: "test izoh (crm akademiya)", reason: "", status: "", image: "", createdAt: "26.07.2026 15:32" },
  { id: 2, type: "employee", cashboxId: null, recipientName: "Abdulloh Raxmatullayev", before: -42391001, amount: 1, after: -42391002, note: "test izoh (crm akademiya)", reason: "", status: "cancelled", image: "", createdAt: "26.07.2026 15:32" },
];
