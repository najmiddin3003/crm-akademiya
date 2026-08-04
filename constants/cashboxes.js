// Moliya → Kassalar uchun demo ma'lumot. Backend /api/cashboxes bo'sh
// kolleksiyani shu massivdan seed qiladi. Faqat birinchi (tanlangan) kassaning
// to'lov turlari bo'yicha taqsimoti manba skrinshotda ko'rsatilgan — qolgan
// kassalarniki kuzatilmagani uchun butun balansi "Naqd"ga qo'yilgan (soddalashtirish).
function zero() {
  return { naqd: 0, plastik: 0, inkassa: 0, terminal: 0, korporativKarta: 0, ilovaClick: 0, yagonaQr: 0, hisobRaqam: 0 };
}

export const CASHBOX_SEED = [
  {
    id: 1,
    name: "2025 - 2026",
    balance: 196533000,
    moderator: "Abdulloh Raxmatullayev",
    onlinePayment: true,
    archived: false,
    isPrimary: true,
    methodTotals: { naqd: 139786000, plastik: 21179000, inkassa: 5665000, terminal: 29133000, korporativKarta: 0, ilovaClick: 0, yagonaQr: 270000, hisobRaqam: 0 },
  },
  {
    id: 2,
    name: "Nilufar Akademiya 1",
    balance: 6510000,
    moderator: "Nilufar Sharipova",
    onlinePayment: false,
    archived: false,
    isPrimary: false,
    methodTotals: { ...zero(), naqd: 6510000 },
  },
  {
    id: 3,
    name: "Dilmurod Akademiya 2",
    balance: 8445000,
    moderator: "Dilmurod Komilov",
    onlinePayment: false,
    archived: false,
    isPrimary: false,
    methodTotals: { ...zero(), naqd: 8445000 },
  },
  {
    id: 4,
    name: "Husanboy Uychi",
    balance: 0,
    moderator: "Abdulloh Raxmatullayev",
    onlinePayment: false,
    archived: false,
    isPrimary: false,
    methodTotals: zero(),
  },
];
