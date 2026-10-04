import type { Db } from "mongodb";
import { isSheetsReady, SALARY_SUMMARY_TAB, type SyncConfig } from "@/lib/sync/config";
import { ensureTab, replaceRows, type SheetCell } from "@/lib/sync/googleSheets";
import { digestLines } from "@/lib/sync/salaryDigest";
import { salaryTypeTag } from "@/lib/salary";

// "XODIM OYLIKLARI" VARAG'I — hisoblangan oylik holati.
//
// ══════════════════════════════════════════════════════════════════
// NEGA ALOHIDA VARAQ (markaz so'rovi, 2026-09-05)
//
// Ilgari "Xodim oyliklari" deb nomlangan varaq bor edi, lekin u
// OYLIKNI KO'RSATMASDI: u kassadan chiqarilgan pulning JURNALI edi —
// har bir avans va oylik alohida qator. Odam u yerda "xodimning oyligi
// qancha?" degan savolga javob topolmasdi.
//
// Endi ikkita varaq:
//   "Xodim avanslari"  — jurnal: qachon, kimga, qancha berilgan
//                        (lib/sync/reconcile.ts, o'zgarmagan mantiq);
//   "Xodim oyliklari"  — SHU YERDA: har xodim uchun bitta qator —
//                        hisoblangan, soliq, olingan, qolgan.
//
// HISOB TAKRORLANMAYDI: raqamlar `salaryDigest.digestLines()` dan
// olinadi, ya'ni Telegram xulosasi bilan AYNAN bir manba. Aks holda
// jadval va guruh xabari vaqt o'tib bir-biridan uzoqlashardi va qaysi
// biri to'g'ri ekanini aniqlash mumkin bo'lmasdi.
//
// QATORLAR TO'LIQ QAYTA YOZILADI, id bo'yicha yangilanmaydi: bu hisob
// natijasi, yozuvlar ro'yxati emas. Kecha 14 o'qituvchi bo'lsa bugun 13
// bo'lishi mumkin — "yetishmagan qatorni qo'shish" bu yerda ma'nosiz.

// Varaq nomi lib/sync/config.ts da — u yerda jurnal varag'i shu nomni
// olib qolmasligi uchun qo'riqchi ham bor.

// "Kartaga" va "Naqd" — kassadan chiqadigan pulning ikki oyog'i
// (kartaga + naqd = chiqariladigan jami). Ular "Qolgan" dan KEYIN turadi:
// mavjud ustunlarning tartibi va joyi o'zgarmasin, jadvalga qarab turgan
// odam eski ustunlarni o'sha yerda topsin.
//
// "Qolgan" — Oylik hisob-kitob sahifasidagi ustun bilan BIR XIL ma'noda
// (16.09.2026 dan): kartadan KEYIN qo'lga beriladigan naqd (hisoblangan
// kartani qoplamasa 0), plastigi yo'qda oddiy qoldiq; manfiy — ortiqcha
// olgan. Karta qoldiqdan birinchi ketadi, shuning uchun musbat qatorda
// Qolgan = Naqd, jami esa Kartaga + Naqd.
//
// DIQQAT: mavjud varaqda `columnCount` yetmasa yangi ustun JIMGINA
// yozilmasdi. `ensureTab` endi gridni kengaytiradi va sarlavhani
// yangilaydi (lib/sync/googleSheets.ts).
//
// "O'tgan oylardan" (04.10.2026, "faqat o'z oyidan chiqarilsin") — o'tgan
// oylarda to'lanmagan, shu oyda TO'LANMAYDIGAN qoldiq (lib/sync/salaryDigest.ts
// → Line.pending): "Qolgan"ga kirmaydi, har biri o'z oyining sahifasidan
// chiqariladi. OXIRIGA qo'shildi — mavjud ustunlar joyidan siljimasin.
const HEADERS = [
  "Xodim", "Lavozim", "Stavka", "Hisoblangan", "Soliq", "Olingan", "Qolgan",
  "Kartaga", "Naqd", "Davr", "Yangilangan", "O'tgan oylardan",
];

/** `turi` kodini odam o'qiydigan yorliqqa. */
function positionLabel(turi: string): string {
  switch (turi) {
    case "teacher": return "O'qituvchi";
    case "moderator": return "Moderator";
    case "admin": return "Administrator";
    default: return turi || "—";
  }
}

/** "DD.MM.YYYY HH:mm" — Toshkent vaqti. */
function uzStamp(d: Date): string {
  const t = new Date(d.getTime() + 5 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getUTCDate())}.${p(t.getUTCMonth() + 1)}.${t.getUTCFullYear()} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

export interface SalarySheetReport {
  written: number;
  errors: string[];
}

/**
 * "Xodim oyliklari" varag'ini qayta yozadi.
 *
 * HECH QACHON OTMAYDI. Sinxronizatsiya sikli ichidan chaqiriladi va bu
 * yerdagi nosozlik to'lovlar solishtiruvini yiqitmasligi kerak — xato
 * hisobotga yozilib, sikl davom etadi.
 */
export async function writeSalarySummary(
  db: Db,
  cfg: SyncConfig,
  at: Date = new Date(),
): Promise<SalarySheetReport> {
  const report: SalarySheetReport = { written: 0, errors: [] };
  if (!isSheetsReady(cfg, "salary")) {
    report.errors.push("Google Sheets sozlanmagan — oylik varag'i yangilanmadi");
    return report;
  }

  try {
    const { teachers, others, period } = await digestLines(db, at);
    const stamp = uzStamp(at);
    // `month` — 0-11 (lib/salary.ts), shu bois +1. Kunlar nisbati oklad
    // xodimlarning hisoblangani NEGA oylik summadan kichik ekanini
    // tushuntiradi: oy hali tugamagan.
    const periodLabel =
      `${String(period.month + 1).padStart(2, "0")}.${period.year} ` +
      `(${period.day}/${period.daysIn} kun)`;

    const rows: SheetCell[][] = [...teachers, ...others].map((l) => [
      l.name,
      positionLabel(l.turi),
      salaryTypeTag(l),
      Math.round(l.earned),
      Math.round(l.tax),
      Math.round(l.paid),
      Math.round(l.cashDue),
      Math.round(l.plastik),
      Math.round(Math.max(l.cashDue, 0)),
      periodLabel,
      stamp,
      Math.round(l.pending),
    ]);

    const target = cfg.targets.salary;
    const tab = await ensureTab(cfg, target.spreadsheetId, SALARY_SUMMARY_TAB, HEADERS);
    await replaceRows(cfg, target.spreadsheetId, tab.tabName, rows);
    report.written = rows.length;
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : "noma'lum xato");
  }
  return report;
}
