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
