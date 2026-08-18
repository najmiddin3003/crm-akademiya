// Xodimning oylik hisob-kitobi — kassa Chiqim oynasidagi "Xodim ma'lumotlarini
// ko'rish" modali va tanlov ostidagi "Oylik: … UZS" satri uchun.
//
// Backend hali yo'q (davomat/bonus/jarima kolleksiyalari qurilmagan), shuning
// uchun qiymatlar loyihadagi odatiy usulda — xodim `id` sidan DETERMINISTIK
// hosil qilinadi. Ya'ni bir xodim uchun har safar bir xil son chiqadi,
// sahifani yangilaganda o'zgarmaydi.
//
// Referensdagi arifmetika saqlangan (skrinshotdan o'lchandi):
//   Davomatdan foizi = Davomat × 50%
//   Oylik  = Davomatdan foizi + Bonus + Akladi − Avans − Jarima
//   Balans = Oylik
// Misol: 41 100 000 → 20 550 000; 20 550 000 − 886 000 = 19 664 000.

export interface SalaryBreakdown {
  davomat: number;
  davomatFoizi: number;
  bonus: number;
  avans: number;
  jarima: number;
  akladi: number;
  oylik: number;
  balans: number;
  ulashish: number;
}

/** Davomatdan hisoblanadigan ulush (referensda 50%). */
const ATTENDANCE_SHARE = 0.5;

export function salaryOf(employeeId: number): SalaryBreakdown {
  const id = Math.abs(Math.trunc(employeeId)) || 1;

  // 10.0 – 69.9 mln, 100 000 qadam bilan.
  const davomat = (((id * 137) % 600) + 100) * 100_000;
  const davomatFoizi = Math.round(davomat * ATTENDANCE_SHARE);

  // Bonus har beshinchi xodimda, jarima har yettinchisida — qolganlarida 0
  // (referensda ham ko'pchiligi nol).
  const bonus = id % 5 === 0 ? (((id * 7) % 20) + 1) * 100_000 : 0;
  const jarima = id % 7 === 0 ? (((id * 3) % 10) + 1) * 50_000 : 0;

  // 0 – 3 990 000, 10 000 qadam bilan (referensda 886 000 kabi qiymatlar).
  const avans = ((id * 53) % 400) * 10_000;

  const akladi = 0;
  const oylik = davomatFoizi + bonus + akladi - avans - jarima;

  return { davomat, davomatFoizi, bonus, avans, jarima, akladi, oylik, balans: oylik, ulashish: 0 };
}

/** Modaldagi qatorlar — tartibi va nomlari referensdagidek. */
export const SALARY_ROWS: { key: keyof SalaryBreakdown; label: string }[] = [
  { key: "davomat", label: "Davomat" },
  { key: "davomatFoizi", label: "Davomatdan foizi" },
  { key: "bonus", label: "Bonus" },
  { key: "avans", label: "Avans" },
  { key: "jarima", label: "Jarima" },
  { key: "akladi", label: "Akladi" },
  { key: "oylik", label: "Oylik" },
  { key: "balans", label: "Balans" },
  { key: "ulashish", label: "Ulashish" },
];
