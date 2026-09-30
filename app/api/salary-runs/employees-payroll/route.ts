import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { attachBranchPayouts, buildPayrollRows } from "@/lib/payrollSources";
import { isMonthKey, payrollHasFoiz, payrollMonthKey, payrollPeriod, payrollPeriodOf, prevMonthKey } from "@/lib/salary";
import { getBranchScope } from "@/lib/branchScope";
import { detectMovedPupils } from "@/lib/teacherHandoverStore";

// GET /api/salary-runs/employees-payroll[?month=YYYY-MM]
// Oylik chiqarish → xodim tanlash jadvali uchun har bir xodimning
// hisoblangan qatori.
//
// Hamma qiymat HAQIQIY manbadan (lib/payrollSources.ts):
//   bonus/jarima ← bonuses, penalties
//   paidAvans/paidOylik ← transaction_entries (shu oydagi chiqimlar)
//   fixedSalary ← xodim kartasidagi filiallar bo'yicha ish haqi
//   percent ← Sozlamalar > Moliya > Oylik foizlari (daraja nomi orqali)
//   carryOver ← o'tgan oy yopilgan salary_runs yozuvi
//
// `configured: false` bo'lgan xodimning raqamlari ma'nosiz — interfeys
// ularni "Oylik sozlanmagan" deb ko'rsatishi kerak.
//
// `?month=` — QAYSI oy hisoblanadi. Parametrsiz joriy oy (eski xulq).
// Bu bo'lmaganda o'tgan oyga sana qo'yib kiritilgan kirim hech qayerda
// ko'rinmasdi: yozuvning `date` i avgustda, filtr esa doim sentabrda edi.
//
// KELAJAK OY HAM O'QILADI — o'quvchi keyingi oy uchun oldindan to'lashi
// odatiy hol va "o'sha oyga qancha tushgan" savoli qonuniy. Kelajak oyda
// `payrollPeriodOf` `day = 0` beradi, ya'ni OKLAD hisoblanmaydi (hali
// ishlanmagan) — faqat haqiqatan tushgan pul ko'rinadi. Pulni chiqarish
// esa boshqa route va u kelajak oyni RAD etadi (POST /api/salary-runs).
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const raw = (params.get("month") ?? "").trim();
  // `?branch=all` — FILIALGA KESILMAGAN ro'yxat. Faqat kassa "Chiqim"
  // oynasi (components/finance/CashboxAdjustDrawer.tsx) shunday so'raydi.
  //
  // NEGA KERAK: o'sha oynada xodimlar ro'yxati /api/hr-employees/ref dan
  // keladi va u ATAYLAB filialga kesilmagan, oylik qatorlari esa shu
  // route'dan — kesilgan holda. Natijada 2-filial kassiri (Dilmurod)
  // ro'yxatdagi 43 xodimdan 42 tasini "Sozlanmagan" ko'rardi: ularning
  // `payrollBranchId` i 1 ga teng. O'lchandi: filial 2 uchun bu route
  // 1 ta qator qaytaradi, filial 1 uchun 42 ta.
  //
  // NEGA XAVFSIZ: kassadagi avans chegarasini SERVER allaqachon GLOBAL
  // hisoblaydi — app/api/cashboxes/[id]/adjust/route.ts xuddi shu
  // `buildPayrollRows` ni filialga kesmasdan chaqiradi va chegarani
  // `payrollCashLeg` / `payrollPayout` bilan oladi, kassaga qaramasdan.
  // Ya'ni bu bayroq yangi ruxsat bermaydi, oynani serverga MOSLAYDI.
  //
  // OYLIK CHIQARISH sahifasi (components/finance/SalaryCreatePage.tsx) bu
  // bayroqni ISHLATMAYDI va ishlatmasligi ham kerak: u yerda kesish ikki
  // marta to'lashni to'sadi (pastdagi izohga qarang).
  const allBranches = (params.get("branch") ?? "").trim() === "all";
  // `?given=1` — javobga KASSA bo'yicha yig'indi (`given`) va qatorlarga
  // `paidElsewhere` qo'shiladi (lib/payrollSources.ts → attachBranchPayouts).
  // Faqat Oylik sahifasi so'raydi: Xodimlar ro'yxati va profil bu route'ni
  // o'z qatorlari uchun o'qiydi va ortiqcha so'rovlarga muhtoj emas.
  const withGiven = !allBranches && (params.get("given") ?? "").trim() === "1";
  if (raw && !isMonthKey(raw)) {
    return NextResponse.json({ ok: false, error: "Oy noto'g'ri (YYYY-MM kutiladi)" }, { status: 400 });
  }

  const period = raw ? payrollPeriodOf(raw) : payrollPeriod();
  const db = await ensureIndexes();
  const scope = await getBranchScope();
  if (!scope) {
    return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  }
  // OYLIK RO'YXATI — `payrollBranchId` bo'yicha, `branchIds` bo'yicha EMAS.
  // Ikki filialda ishlaydigan xodim faqat BITTA filialning ro'yxatida
  // turadi, ya'ni oylik ikki marta chiqarilishi mumkin emas.
  const employees = await buildPayrollRows(
    db,
    period,
    allBranches ? {} : { payrollBranchId: scope.branchId },
  );
  // `month` QAYTARILADI: mijoz qaysi oy hisoblanganini taxmin qilmasin —
  // parametrsiz so'rovda ham server tanlagan oy aniq bo'lsin.
  const month = payrollMonthKey(period);
  // `branchId` — ro'yxat QAYSI FILIAL uchun tuzilgani (30.09.2026). Oylik
  // sahifasi uni «Oylikni chiqarish» so'rovida qaytaradi: filial tanlovi
  // cookie'da va brauzerning HAMMA oynalari uchun bitta — boshqa oynada
  // almashtirilsa, bu oyna eski ro'yxatni ko'rsatib turaveradi
  // (app/api/salary-runs/route.ts → POST dagi qorovul).
  const branchId = allBranches ? null : scope.branchId;
  if (!withGiven) return NextResponse.json({ ok: true, month, branchId, employees });

  // "Berilgan avans" / "To'langan oylik" kartochkalari — pul QAYSI FILIAL
  // KASSASIDAN chiqqani bo'yicha. Qatorlarning o'z raqamlari o'zgarmaydi.
  const { rows, given } = await attachBranchPayouts(db, month, scope.branchId, employees);

  // USTOZ ALMASHUVI ESLATMASI — faqat JORIY va O'TGAN oy: o'quvchining
  // "hozirgi guruhi" eski oylar uchun ma'nosiz, o'tgan oy esa oy boshida
  // oylik chiqarilayotganda kerak (lib/teacherHandoverStore.ts).
  const cur = payrollPeriod();
  const recent = month === payrollMonthKey(cur) || month === prevMonthKey(cur);
  if (!recent) return NextResponse.json({ ok: true, month, branchId, employees: rows, given });
  const hints = await detectMovedPupils(
    db,
    month,
    rows.filter((e) => e.configured && payrollHasFoiz(e)).map((e) => e.name),
  );
  const withHints = hints.size === 0 ? rows : rows.map((e) => {
    const h = hints.get(String(e.name ?? "").trim().toLowerCase());
    return h ? { ...e, movedHint: h } : e;
  });
  return NextResponse.json({ ok: true, month, branchId, employees: withHints, given });
}
