// Moliya → Oylik chiqarish. "Avans"/"Akladi" (xodimga oldindan berilgan
// pul / unga kiritilgan pul) uchun loyihada alohida real kuzatuv funksiyasi
// hali yo'q — shuning uchun xodim id'sidan deterministik demo qiymat
// hosil qilinadi (boshqa demo generatorlar bilan bir xil uslub, masalan
// constants/employees.js buildRest()). BONUS/JARIMA esa REAL — Moliya →
// Bonus/Jarima kolleksiyalaridan shu xodimga tegishli (bekor qilinmagan)
// yozuvlar yig'indisi sifatida hisoblanadi (server tomonida).
function hash(n) {
  let h = (n * 2654435761) % 2147483647;
  if (h < 0) h += 2147483647;
  return h;
}

export function demoAvans(employeeId) {
  return hash(employeeId) % 30000000;
}

export function demoAkladi(employeeId) {
  const h = hash(employeeId + 97);
  return h % 5 === 0 ? h % 60000000 : 0;
}

// Foizli xodim orqali shu oyda tushgan pul (o'z oyi uchun asos). Real
// tushum trekingi hali yo'q — deterministik demo.
export function demoCollected(employeeId) {
  const h = hash(employeeId + 131);
  return Math.round((h % 60) * 100000) * 10; // 0..60_000_000, 100k aniqligida
}

// Foizli xodimning oladigan foizi. HrEmployee.percent bo'lsa, uni
// parselaymiz. Aks holda deterministik demo (25..50%).
export function demoPercent(employeeId) {
  const opts = [30, 35, 40, 45, 50];
  return opts[hash(employeeId + 41) % opts.length];
}

// O'tgan oydan qolgan qarz (har 3-xodimda). Faqat "Iyul oyidan qolgan"
// izohli qismni ko'rsatish uchun demo.
export function demoCarryOver(employeeId) {
  const h = hash(employeeId + 17);
  return h % 3 === 0 ? Math.round((h % 20) * 100000) : 0;
}

export const SALARY_RUN_SEED = [
  {
    id: 1,
    employeeCount: 1,
    oylik: 0,
    davomat: 12056153,
    davomatFoizi: 6028076.5,
    bonus: 0,
    avans: 2400000,
    jarima: 0,
    akladi: 0,
    tolanmagan: 6743847,
    createdAt: "26.07.2026 | 16:10",
  },
];
