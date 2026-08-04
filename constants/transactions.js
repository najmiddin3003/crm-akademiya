// Moliya → Moliya analitikasi. Kunlik umumiy kirim/chiqim — Iyul 2026,
// manba skrinshotidagi Kalendar ko'rinishidan aniq porlangan (har kun uchun
// tekshirilgan: oldingi kun balansi + shu kun kirim - chiqim = shu kun
// balansi, va 1-26 kunlar yig'indisi = 227 413 000 UZS umumiy balansga mos
// keladi). 27-31 kunlar hali kelmagan (faoliyat yo'q). Foydalanuvchi bilan
// kelishilgan yengil qamrov: FAQAT shu oy uchun to'liq generatsiya qilinadi,
// boshqa oylar bo'sh qoladi (Pul oqimi grafigida faqat Iyulda cho'qqi bo'ladi).
import { PAYMENT_METHODS_SEED } from "@/constants/settingsLists";

export const JULY_2026_DAILY = [
  { day: 1, income: 8818000, expense: 325000 },
  { day: 2, income: 8556000, expense: 2527000 },
  { day: 3, income: 8892000, expense: 3760000 },
  { day: 4, income: 8214000, expense: 5749000 },
  { day: 5, income: 0, expense: 0 },
  { day: 6, income: 14570000, expense: 6270000 },
  { day: 7, income: 9257000, expense: 6995000 },
  { day: 8, income: 3826000, expense: 1557000 },
  { day: 9, income: 8496000, expense: 3883000 },
  { day: 10, income: 6395000, expense: 4300000 },
  { day: 11, income: 7244000, expense: 3215000 },
  { day: 12, income: 270000, expense: 100000 },
  { day: 13, income: 9080000, expense: 2024000 },
  { day: 14, income: 9855000, expense: 5295000 },
  { day: 15, income: 12085000, expense: 6440000 },
  { day: 16, income: 13334000, expense: 5780000 },
  { day: 17, income: 22203000, expense: 5320000 },
  { day: 18, income: 19135000, expense: 17081000 },
  { day: 19, income: 1600000, expense: 100000 },
  { day: 20, income: 19907000, expense: 2978000 },
  { day: 21, income: 31056000, expense: 4110000 },
  { day: 22, income: 26125000, expense: 6675000 },
  { day: 23, income: 29467000, expense: 6398000 },
  { day: 24, income: 31305000, expense: 12275000 },
  { day: 25, income: 30380000, expense: 15425000 },
  { day: 26, income: 17587000, expense: 1662000 },
];

export const INCOME_CATS = ["O'quvchi to'ladi", "Kitob", "Oylik imtihon", "Olimpiada", "Sarmoya", "Boshqa"];
export const EXPENSE_CATS = ["Hodimga avans", "Hodimga oylik", "Marker", "Internet va telefon", "List", "Printer", "Suv", "Elektr", "Xo'jalik ishlari", "Kitob", "Divident", "Boshqa"];

// To'lov usullarining RO'YXATI bu yerda emas — u yagona manbadan
// (constants/settingsLists.js → Sozlamalar → Moliya → To'lov turlari).
// Bu yerda faqat demo generator uchun OG'IRLIKLAR: qaysi tur qanchalik
// tez-tez uchrashi. Og'irligi ko'rsatilmagan tur kamdan-kam chiqadi.
//
// DIQQAT: generator boshlang'ich (seed) ro'yxatdan foydalanadi, jonli
// bazadan emas — u sinxron ishlaydi va bir marta demo tranzaksiyalarni
// yaratadi. Keyin qo'shilgan to'lov turi eski demo yozuvlarni o'zgartirmasligi
// kerak ham.
const METHOD_WEIGHTS = {
  naqd: 70,
  terminal: 15,
  plastik: 11,
  inkassa: 3,
  yagonaQr: 0.6,
  hisobRaqam: 0.3,
  ilovaClick: 0,
  korporativKarta: 0,
};

export const PAYMENT_METHODS = PAYMENT_METHODS_SEED.map((m) => ({
  key: m.key,
  label: m.name,
  weight: METHOD_WEIGHTS[m.key] ?? 0.1,
}));

export const CASHBOX_IDS = [1, 2, 3, 4];

function hash(n) {
  let h = (Math.imul(n, 2654435761) >>> 0) % 2147483647;
  return h < 0 ? h + 2147483647 : h;
}
function weightedPick(list, seed) {
  const total = list.reduce((s, x) => s + x.weight, 0);
  const r = (hash(seed) % 10000) / 10000 * total;
  let acc = 0;
  for (const item of list) {
    acc += item.weight;
    if (r <= acc) return item;
  }
  return list[list.length - 1];
}
// `count` musbat butun sonlarga bo'ladi, ularning yig'indisi ANIQ `total`ga teng
// (og'irliklarni normallashtirib, oxirgisiga qoldiqni qo'shish orqali).
function splitAmount(total, count, seed) {
  if (count <= 1) return [total];
  const weights = Array.from({ length: count }, (_, i) => 1 + (hash(seed + i * 7) % 20));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => Math.round((w / sumW) * total));
  const diff = total - parts.reduce((a, b) => a + b, 0);
  parts[parts.length - 1] += diff;
  return parts;
}

// Bitta kun uchun (kirim va chiqim alohida) individual tranzaksiyalarga bo'lib
// chiqadi — Journal jadvalidagi qatorlar shular.
function buildDayTransactions(day, income, expense, idRef) {
  const out = [];
  const dateIso = `2026-07-${String(day).padStart(2, "0")}`;

  function emit(total, cats, sign) {
    if (total <= 0) return;
    const seedBase = day * 97 + (sign > 0 ? 1 : 2);
    const count = 3 + (hash(seedBase) % 7); // 3..9 ta tranzaksiya
    const parts = splitAmount(total, count, seedBase);
    parts.forEach((amount, i) => {
      if (amount === 0) return;
      const s = seedBase * 31 + i * 13;
      const cat = weightedPick(cats, s).key ?? cats[hash(s) % cats.length];
      const method = weightedPick(PAYMENT_METHODS, s + 3);
      const cashboxId = CASHBOX_IDS[hash(s + 5) % CASHBOX_IDS.length];
      const hh = String(6 + (hash(s + 7) % 14)).padStart(2, "0");
      const mm = String(hash(s + 11) % 60).padStart(2, "0");
      out.push({
        id: idRef.next++,
        date: dateIso,
        time: `${hh}:${mm}`,
        amount: amount * sign,
        category: typeof cat === "string" ? cat : cat.label,
        method: method.key,
        methodLabel: method.label,
        cashboxId,
      });
    });
  }

  // Kategoriya ro'yxatlarini og'irlik bilan (asosiy kategoriya ustun bo'lishi
  // uchun — real taqsimotga yaqinroq ko'rinish).
  const incomeCats = [
    { key: "O'quvchi to'ladi", weight: 90 },
    { key: "Kitob", weight: 7 },
    { key: "Boshqa", weight: 3 },
  ];
  const expenseCats = [
    { key: "Hodimga avans", weight: 55 },
    { key: "Boshqa", weight: 15 },
    { key: "Elektr", weight: 8 },
    { key: "Suv", weight: 6 },
    { key: "Printer", weight: 6 },
    { key: "Internet va telefon", weight: 5 },
    { key: "Xo'jalik ishlari", weight: 4 },
    { key: "Kitob", weight: 1 },
  ];

  emit(income, incomeCats, 1);
  emit(expense, expenseCats, -1);
  return out;
}

export function buildJuly2026Transactions() {
  const idRef = { next: 1 };
  const all = [];
  for (const d of JULY_2026_DAILY) {
    all.push(...buildDayTransactions(d.day, d.income, d.expense, idRef));
  }
  return all;
}
