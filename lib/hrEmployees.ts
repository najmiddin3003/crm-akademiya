// Boshqaruv → Xodimlar (edutizim dizayni) uchun umumiy tip. API route'lari va
// klient komponentlar (ro'yxat, qo'shish modali, profil) shuni bo'lishadi.
// MongoDB `hr_employees` kolleksiyasi — invite oqimidagi `employees`dan ALOHIDA.
/**
 * Xodimning bitta filialdagi biriktiruvi — Xodim qo'shish modalidagi
 * "Filiallar / Rollar / Ish jadvali / Ish haqi" jadvalining bir qatori.
 * Faqat galochka qo'yilgan filiallar saqlanadi.
 */
export interface EmployeeBranchAssignment {
  branchId: number;
  roleId: number | null;     // /api/roles
  scheduleId: number | null; // /api/work-schedules
  salary: number;            // UZS, butun son
}

export interface HrEmployee {
  id: number;
  name: string;
  gender: string; // "male" | "female"
  aktivOq: number;
  groups: number;
  /**
   * Lavozim: "teacher" | "moderator" | "admin".
   *
   * Xodim CRM'ning qaysi bo'limlarini ko'rishi ODATDA shu maydondan kelib
   * chiqadi — `roles` dagi bir xil kalitli yozuv orqali (lib/roles.ts).
   * Lavozim o'zgarsa, ruxsatlar ham o'zi o'zgaradi.
   */
  turi: string;
  /**
   * SHU XODIM uchun alohida ruxsatlar — lavozim sozlamasidan USTUN turadi.
   *
   *   maydon yo'q yoki null → istisno yo'q, lavozim ro'yxati amal qiladi
   *   [...]                 → aynan shu bo'limlar (lavozimdan qat'i nazar)
   *
   * Bo'sh massiv ham HAQIQIY istisno: "hech qanday bo'lim ko'rinmasin"
   * degani (doim ochiq sahifalardan tashqari). Shu sabab "istisno bormi"
   * savoli uzunlik bilan emas, `Array.isArray` bilan tekshiriladi.
   */
  permissions?: string[] | null;
  filial: string;
  phone: string;
  kurs: string;
  created: string;
  lastActive: string;
  archReason: string;
  archDate: string; // "Sana" ustuni — arxivlash sababi qayd etilgan sana
  email?: string;
  // Vazifaga qarab to'ldiriladi (Xodim qo'shish modalidagi 3-qator).
  // Ixtiyoriy: eski hujjatlarda bu maydonlar yo'q.
  percent?: string; // Oladigan foizi (faqat o'qituvchi) — Sozlamalar > Moliya > Oylik foizlari
  /**
   * Darajasi — grading tizimidagi LAVOZIM nomi. Manba vazifaga qarab
   * ikki xil bo'ladi va ular ARALASHTIRILMAYDI:
   *   o'qituvchi → Sozlamalar > Boshqaruv > O'qituvchilar grading tizimi
   *   moderator  → Sozlamalar > Boshqaruv > Menejer grading tizimi
   */
  degree?: string;
  /**
   * Bandlik darajasi — "Yarim stavka" | "Bir stavka" (faqat moderator).
   * Menejer grading tizimida har lavozimning ikkala stavkasi turadi;
   * xodim shulardan qaysi biri bo'yicha ishlashini shu maydon aytadi.
   */
  employmentRate?: string;
  /** Cloudinary'dagi profil rasmi (secure_url). */
  photoUrl?: string;
  /** Belgilangan filiallar bo'yicha rol/jadval/ish haqi. */
  branchAssignments?: EmployeeBranchAssignment[];
  /**
   * Xodim QAYSI FILIALLARDA ishlaydi (`branches.id`).
   *
   * Navbardagi filial ro'yxati shundan chiqadi (lib/branchScope.ts): xodim
   * faqat shu filiallarni ko'radi va ular orasida almashadi. Admin
   * bundan mustasno — u hammasini ko'radi.
   *
   * `branchAssignments` dan FARQ QILADI: u filial bo'yicha ISH HAQI
   * sozlagichi. O'lchandi — u to'ldirilgan 11 xodimning 9 tasida
   * `branchId: 3` turgan, holbuki butun ma'lumot 1-filialga tegishli edi.
   *
   * Maydon yo'q eski hujjatlarda xodim birinchi filialga tushadi.
   */
  branchIds?: number[];
  /**
   * OYLIK QAYSI FILIALDAN CHIQADI — aynan BITTA filial.
   *
   * `branchIds` ko'p qiymatli (xodim ikki filialda ishlashi mumkin), pul
   * esa BIR MARTA chiqishi shart. Oylik ro'yxati `branchIds` bo'yicha
   * kesilsa, [1,2] xodim ikkala filial ro'yxatida to'liq summa bilan
   * turardi va ikki admin uni ikki marta to'lashi mumkin edi.
   *
   * INVARIANT: `branchIds.includes(payrollBranchId)`.
   * Sukut — `branchIds[0]`, lekin qo'lda o'zgartiriladi (biznes qarori).
   *
   * Maydon yo'q eski hujjatlarda oylik ro'yxati uni KO'RMAYDI — backfill
   * shu sabab majburiy (scripts/migrate-payroll-branch.mjs).
   */
  payrollBranchId?: number;
  /**
   * Shu xodimga QAYSI soliq turlari qo'llanishi — Sozlamalar → Moliya →
   * Soliq ro'yxatidagi yozuvlarning id'lari.
   *
   * Bo'sh yoki yo'q bo'lsa soliq umuman hisoblanmaydi. Ilgari bu yerda
   * `taxable: boolean` turardi va yoqilgan xodimga ro'yxatdagi HAMMA faol
   * qoida qo'llanardi — ya'ni bir xodimga faqat daromad solig'ini, boshqasiga
   * esa yana INPS'ni biriktirib bo'lmasdi. Endi tanlov xodim kesimida.
   */
  taxIds?: number[];
  /**
   * Shu xodimga PLASTIK KARTA orqali beriladigan oylik summasi (so'm).
   *
   * QO'LDA yoziladi va har kimda har xil bo'ladi — kimgadir 2 000 000,
   * kimgadir 4 000 000. Shu bois Sozlamalardagi tayyor ro'yxatdan
   * TANLANMAYDI: erkin summani oldindan sanab bo'lmaydi.
   *
   * `null` yoki maydon yo'q → plastik biriktirilmagan: xodim butun oyligini
   * bugungidek bitta kanal bilan oladi.
   *
   * IKKI XIL ISHGA ISHLATILADI va ular ARALASHTIRILMASLIGI SHART:
   *   1. SOLIQ ASOSI — "Plastik qismidan" bazali foizli qoida aynan shu
   *      NOMINAL summadan hisoblanadi. Davrga, avansga va shu oyda
   *      allaqachon to'langan summaga BOG'LIQ EMAS.
   *   2. KARTA OYOG'I MAQSADI — chiqarishda kartaga qancha yuborilishi
   *      (davrga bo'lingan summa − shu oyda kartadan berilgani), ya'ni oy
   *      ichida kamayib boradigan qiymat. Qoldiq bilan CHEKLANMAYDI:
   *      karta to'liq chiqadi, xodimga qo'lga undan oshgani beriladi
   *      (lib/salary.ts → payrollPlastikLeg / payrollCashLeg).
   * Agar soliq asosi ham karta oyog'idan olinsa, bir oyda IKKINCHI marta
   * chiqarishda maqsad 0 bo'lgani uchun soliq ham 0 chiqadi va o'sha oyda
   * allaqachon ushlangan soliq xodimga QAYTIB berilardi (`payrollDue`
   * soliqni har safar boshidan qayta hisoblaydi).
   *
   * NIMA UCHUN SKALYAR, `taxIds` KABI MASSIV EMAS: ikkita soliqni birga
   * biriktirish ma'noli, ikkita plastik summa esa — qo'sh hisob.
   */
  plastikSalary?: number | null;
}

/**
 * Mijozdan kelgan filial biriktiruvlarini xavfsiz ko'rinishga keltiradi.
 * POST /api/hr-employees va PATCH /api/hr-employees/:id ikkalasi ham shuni
 * ishlatadi — `salary` oylik hisobiga va kassadagi chiqim chegarasiga
 * ta'sir qiladi, shu bois u albatta SON bo'lishi kerak. Satr kelib qolsa,
 * yig'indi qo'shilish o'rniga birikib ketadi.
 */
export function sanitizeAssignments(raw: unknown): EmployeeBranchAssignment[] {
  if (!Array.isArray(raw)) return [];
  const out: EmployeeBranchAssignment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const branchId = Number(r.branchId);
    if (!Number.isFinite(branchId)) continue;
    const roleId = Number(r.roleId);
    const scheduleId = Number(r.scheduleId);
    const salary = Number(r.salary);
    out.push({
      branchId,
      roleId: Number.isFinite(roleId) && roleId > 0 ? roleId : null,
      scheduleId: Number.isFinite(scheduleId) && scheduleId > 0 ? scheduleId : null,
      salary: Number.isFinite(salary) && salary > 0 ? Math.trunc(salary) : 0,
    });
  }
  return out;
}

/** Filiallar bo'yicha ish haqi yig'indisi — "oklad". */
export function fixedSalaryOf(emp: { branchAssignments?: EmployeeBranchAssignment[] }): number {
  return (emp.branchAssignments ?? []).reduce((s, b) => s + (Number(b?.salary) || 0), 0);
}

/**
 * Xodimning ish haqi SOZLANGANMI. Bu "0 so'm" dan farq qiladi: sozlanmagan
 * xodim uchun hech qanday raqam ko'rsatilmasligi kerak (soxta 0 emas), va
 * kassadagi oylik chegarasi ham unga qo'llanmaydi.
 */
export function isSalaryConfigured(emp: { branchAssignments?: EmployeeBranchAssignment[] }): boolean {
  return fixedSalaryOf(emp) > 0;
}

/**
 * Mijozdan kelgan plastik summani tozalaydi.
 *
 * `null` — BIRIKTIRILMAGAN (haqiqiy qiymat, "tegilmadi" emas): oyna
 * "Biriktirilmagan qilish" tugmasi bilan aynan shuni yuboradi.
 *
 * DIQQAT: bu yerda `sanitizeAssignments` dagi `> 0 ? n : 0` naqshi
 * TAKRORLANMAYDI. U yerda 0 — "oylik yo'q" degan qonuniy qiymat, bu yerda
 * esa 0 va "biriktirilmagan" farqlanishi kerak: 0 yozib qo'yilsa xodimda
 * plastik qoidasi bor-u summasi yo'q holat paydo bo'lardi va soliq JIMGINA
 * nolga tushardi.
 */
export function sanitizePlastikSalary(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Hisobda ishlatiladigan plastik summa. Biriktirilmagan xodimda 0. */
export function plastikSalaryOf(emp: { plastikSalary?: number | null }): number {
  const n = Number(emp?.plastikSalary);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}
