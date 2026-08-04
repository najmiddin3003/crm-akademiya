// Moliya → Shartnoma demo ma'lumotlari. Faqat bog'lovchi (link) maydonlar —
// studentOrderId/moderatorId — shu yerda qattiq yozilgan; studentName/
// moderatorName API route'da createInitialOrders()/EMPLOYEES_DATA'dan
// seed vaqtida topib to'ldiriladi (haqiqiy ism/link mos kelishi uchun,
// qo'lda yozilgan ism xato bo'lib qolmasligi uchun).
//
// studentOrderId qiymatlari lib/ordersData.ts'dagi qattiq yozilgan SEED
// massividan olingan (id lar 1..502 EMAS — buildOrders() 5500 atrofidagi
// formulali id lar generatsiya qiladi; shu 15 ta SEED yozuvining id si
// har doim barqaror, shuning uchun ular ishlatilgan).
export const CONTRACT_SEED = [
  {
    studentOrderId: 6013, // Hilola Rahmatullayeva
    moderatorId: 2,
    comment: "1-oylik shartnoma",
    archived: false,
    createdAt: "01.07.2026 | 09:12",
    parts: [{ id: 1, amount: 1500000, date: "2026-07-01", comment: "1-oy to'lovi" }],
  },
  {
    studentOrderId: 5822, // Jahongir Ahmadjanov
    moderatorId: 4,
    comment: "",
    archived: false,
    createdAt: "15.06.2026 | 14:30",
    parts: [
      { id: 1, amount: 2000000, date: "2026-06-15", comment: "Boshlang'ich to'lov" },
      { id: 2, amount: 500000, date: "2026-07-15", comment: "Qo'shimcha to'lov" },
    ],
  },
  {
    studentOrderId: 5819, // Muattar Yoldasheva
    moderatorId: 9,
    comment: "test izoh (crm akademiya test)",
    archived: false,
    createdAt: "26.07.2026 | 23:03",
    parts: [{ id: 1, amount: 1, date: "2026-07-26", comment: "" }],
  },
  {
    studentOrderId: 5807, // Saida Mansurova
    moderatorId: 9,
    comment: "Chegirmali shartnoma",
    archived: false,
    createdAt: "05.05.2026 | 09:00",
    parts: [
      { id: 1, amount: 1200000, date: "2026-05-05", comment: "" },
      { id: 2, amount: 1200000, date: "2026-06-05", comment: "" },
      { id: 3, amount: 1200000, date: "2026-07-05", comment: "" },
    ],
  },
  {
    studentOrderId: 5774, // Aziza Olimova
    moderatorId: 2,
    comment: "test",
    archived: true,
    createdAt: "22.11.2025 | 10:37",
    parts: [{ id: 1, amount: 2000100, date: "2025-11-22", comment: "" }],
  },
  {
    studentOrderId: 5770, // Shahnoza Bahriddinova
    moderatorId: 4,
    comment: "",
    archived: true,
    createdAt: "10.03.2026 | 11:00",
    parts: [{ id: 1, amount: 3000000, date: "2026-03-10", comment: "To'liq to'lov" }],
  },
];
