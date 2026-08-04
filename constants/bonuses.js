// Moliya → Bonus. "Tranzaksiya turi" tanlovi kim bonus olishini belgilaydi:
// `label` — qo'shish formasidagi tanlov matni (skrinshot 2/3), `tableLabel`
// — shu turdagi yozuv ro'yxat jadvalida "BONUS TURI" ustunida qanday
// ko'rinishi (skrinshot 1'da "student" turi "Talaba bonusi" deb chiqqan —
// forma tanlovi bilan bir xil matn emas, shuning uchun ikkisi ajratilgan).
export const BONUS_TYPES = [
  { value: "employee", label: "Xodimga bonus", tableLabel: "Xodim bonusi" },
  { value: "student", label: "O'quv markaz hisobidan", tableLabel: "Talaba bonusi" },
];

export const BONUS_SEED = [
  {
    id: 1,
    type: "student",
    cashboxId: null,
    recipientName: "Dilshoda Hasanboyeva",
    givenBy: "Abdulloh Raxmatullayev",
    before: 750000,
    amount: 100,
    after: 750100,
    note: "test",
    reason: "",
    status: "",
    createdAt: "19.12.2025 10:22",
  },
];
