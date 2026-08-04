// Moliya → Tranzaksiyalar demo generatori. Har bir (kassa, to'lov turi)
// juftligi o'zining ketma-ket "oldingi/keyingi miqdor" zanjiriga ega —
// generator hodisalarni XRONOLOGIK tartibda yaratadi (eskisidan yangisiga),
// har birining "oldingi"sini o'sha juftlikning oxirgi "keyingi"sidan oladi,
// keyin ro'yxatni EKRANDAGIDEK teskari (yangidan eskiga) tartibga o'giradi.
const MODERATORS = ["Dilmurod Komilov", "Nilufar Sharipova"];
const CASHBOX_METHODS = [
  { cashboxId: 1, paymentType: "Naqd" },
  { cashboxId: 1, paymentType: "Plastik" },
  { cashboxId: 2, paymentType: "Terminal" },
  { cashboxId: 3, paymentType: "Naqd" },
];

function hash(n) {
  const h = (Math.imul(n, 2654435761) >>> 0) % 2147483647;
  return h < 0 ? h + 2147483647 : h;
}

// Xronologik tartibda hodisalar reja(t)si — [lane index, event turi, miqdor,
// (ixtiyoriy) o'quvchi, holat]. Har bir "transfer" ikkita qatorli yoziladi
// (chiqadigan kassa -miqdor, tushadigan kassa +miqdor — manbada ikkalasi ham
// -miqdor ko'rinishida chiqqan, aynan shu ko'rinish takrorlangan).
const PLAN = [
  { lane: 0, type: "payIn", amount: 250000, student: "Sevinch Qodirova" },
  { lane: 0, type: "payIn", amount: 350000, student: "Bekzod Rahimov" },
  { lane: 3, type: "payIn", amount: 270000, student: "Zarina Yusupova" },
  { lane: 0, type: "payIn", amount: 270000, student: "Nixola Ortigaliyeva" },
  { lane: 1, type: "payIn", amount: 270000, student: "Munisa Zokirova" },
  { lane: 0, type: "payIn", amount: 250000, student: "Mustafo Mamedov" },
  { lane: 0, type: "payIn", amount: 350000, student: "Shohrux Kamoliddinov" },
  { lane: 0, type: "payIn", amount: 270000, student: "Rayxona Abdugaffarova" },
  { lane: 0, type: "payIn", amount: 110000, student: "Nafisa Elyorbekova" },
  { lane: 0, type: "payIn", amount: 270000, student: "Maxdiya Toychibayeva" },
  { lane: 0, type: "payOut", amount: -812000, txName: "Hodimga avans" },
  { lane: 0, type: "transfer", amount: -10000000 },
  { lane: 2, type: "transfer", amount: -10000000, status: "waiting" },
  { lane: 0, type: "transfer", amount: -790000 },
  { lane: 2, type: "transfer", amount: -790000, status: "waiting" },
  { lane: 0, type: "transfer", amount: -1745000 },
  { lane: 1, type: "transfer", amount: -1745000 },
  { lane: 1, type: "payIn", amount: 270000, student: "Munisa Zokirova", status: "cancelled" },
  { lane: 0, type: "payIn", amount: 350000, student: "Bekzod Rahimov" },
  { lane: 0, type: "payIn", amount: 270000, student: "Zarina Yusupova" },
  { lane: 0, type: "payOut", amount: -420000, txName: "Ofis xarajati" },
  { lane: 3, type: "payIn", amount: 180000, student: "Sevinch Qodirova" },
  { lane: 0, type: "payIn", amount: 270000, student: "Nixola Ortigaliyeva" },
  { lane: 0, type: "payIn", amount: 350000, student: "Mustafo Mamedov" },
  { lane: 1, type: "payIn", amount: 270000, student: "Shohrux Kamoliddinov" },
  { lane: 0, type: "payOut", amount: -250000, txName: "Hodimga avans" },
  { lane: 0, type: "payIn", amount: 270000, student: "Rayxona Abdugaffarova" },
  { lane: 0, type: "payIn", amount: 110000, student: "Nafisa Elyorbekova" },
];

function buildTransactionEntries() {
  const laneBalance = CASHBOX_METHODS.map(() => 0);
  const startDate = new Date(2026, 6, 26, 17, 5); // 26.07.2026 17:05 dan orqaga
  const rows = PLAN.map((ev, i) => {
    const lane = CASHBOX_METHODS[ev.lane];
    const before = laneBalance[ev.lane];
    const after = ev.type === "transfer" ? null : before + ev.amount;
    laneBalance[ev.lane] = before + ev.amount;

    const minutesAgo = (PLAN.length - i) * 3;
    const d = new Date(startDate.getTime() - minutesAgo * 60000);
    const pad = (n) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const h = hash(i);
    return {
      id: i + 1,
      date,
      time,
      studentName: ev.student || "",
      amount: ev.amount,
      before,
      after,
      txType: ev.type,
      txName: ev.type === "payIn" ? "O'quvchi to'ladi" : ev.type === "payOut" ? ev.txName || "Boshqa" : "",
      paymentType: lane.paymentType,
      group: "",
      lessonDate: "",
      moderator: MODERATORS[h % MODERATORS.length],
      reason: "-",
      note: "",
      status: ev.status || "",
      cashboxId: lane.cashboxId,
    };
  });
  return rows.reverse(); // yangidan eskiga (ekrandagidek)
}

export const TRANSACTION_ENTRY_SEED = buildTransactionEntries();
