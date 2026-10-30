import { IS_AKADEMIYA } from "@/lib/center";

// FILIAL HOVUZLARI — bitta hovuzdagi filiallar KASSA va OYLIKDAN BOSHQA
// hamma joyda BITTA filialdek ko'rinadi (qaror 09.10.2026, foydalanuvchi:
// «2 ta filialni kassasidan boshqa hamma yerni bitta qilishimiz kerak»;
// oylik ham filial bo'yicha qoladi — o'sha kuni tanlangan).
//
// «Akademiya 1 Chortoq» va «Akademiya 2 Chortoq» — bitta shahardagi ikki
// bino: o'quvchilar, guruhlar, xonalar, lidlar, o'qituvchilar, jadval,
// hisobotlar va KPI ikkalasida bir xil. 07.09.2026 dan bu hovuz faqat
// o'quvchilar uchun edi (PUPIL_BRANCH_POOLS, lib/branchScope.ts).
//
// MA'LUMOT KO'CHIRILMAYDI: har yozuv o'z `branchId` si bilan qoladi, faqat
// O'QISH sharti hovuzni oladi (lib/branchScope.ts → `branchCondition`).
// Ya'ni qaytarish oson — ro'yxatdan hovuzni olib tashlash yetadi.
//
// QAT'IY (hovuzsiz) QOLADIGANLAR — `strictBranchCondition` /
// `strictScopedEmployeeFilter`:
//   • kassa — u filialga emas, mas'ul shaxsga qarab kesiladi (GET /api/cashboxes);
//   • oylik — `payrollBranchId`, oy qulfi va yopish filial bo'yicha
//     (app/api/salary-runs/*, lib/ai/tools/payroll.ts), xodimlar balansi hisoboti;
//   • xodim davomati (QR / turniket) — jismoniy bino va uning ish vaqti.
//
// Bu fayl SERVERGA BOG'LIQ EMAS (cookie/baza yo'q) — mijoz komponentlari
// ham shu qoidadan foydalanadi (Xonalar ro'yxati, lid → guruh tanlovi).
// Yangi filial qo'shilsa yoki hovuz o'zgarsa — faqat shu ro'yxat.
//
// BOSHQA MARKAZ (30.10.2026, lib/center.ts): hovuzlar `NEXT_PUBLIC_BRANCH_POOLS`
// dan — «1+2» yoki «1+2,3+4»; bo'sh qiymat — hovuz yo'q. Berilmasa: Akademiya
// nusxasida [[1, 2]], boshqa markazda — yo'q (uning 1- va 2-filiali bitta
// bo'lib qolmasin).

function parsePools(raw: string | undefined): number[][] {
  if (raw === undefined) return IS_AKADEMIYA ? [[1, 2]] : [];
  return raw
    .split(",")
    .map((part) => part.split("+").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0))
    .filter((pool) => pool.length > 1);
}

export const BRANCH_POOLS: readonly (readonly number[])[] = parsePools(process.env.NEXT_PUBLIC_BRANCH_POOLS);

/** Filial → u qatnashadigan hovuz (yo'q bo'lsa — o'zi yolg'iz). */
export function branchPool(branchId: number): readonly number[] {
  return BRANCH_POOLS.find((p) => p.includes(branchId)) ?? [branchId];
}

/** Ikki filial bitta hovuzdami (bir xil filial ham — ha). */
export function sameBranchPool(a: number, b: number): boolean {
  return a === b || branchPool(a).includes(b);
}

/** Filiallar ro'yxatini hovuzlari bilan kengaytiradi (takrorsiz, tartib saqlanadi). */
export function expandBranchPools(ids: readonly number[]): number[] {
  const out: number[] = [];
  for (const id of ids) for (const b of branchPool(id)) if (!out.includes(b)) out.push(b);
  return out;
}

// ── KO'RINISH: hovuz BITTA filial (10.10.2026) ──────────────────────────
//
// Foydalanuvchi: «filial 1 va filial 2 ni bitta yagona Akademiya Chortoq ga
// o'tkazamiz … kassa shundoq holicha qoladi, faqat ko'rinish o'zgarsin».
// MA'LUMOT KO'CHIRILMAYDI: har yozuv o'z binosining `branchId` si bilan
// qoladi, ikkala filial hujjatining NOMI esa bir xil («Akademiya Chortoq»).
//
//   • TANLOV ro'yxatlari (navbar, filtrlar, ommaviy formalar) — hovuz BITTA
//     qator (`collapseBranchPools`); filtr qiymati hovuzning vakili,
//     solishtirish `sameBranchPool` bilan.
//   • BINO kerak joylar (xodimning filial qatorlari, xona, Filiallar
//     boshqaruvi, Oylik va QR almashtirgichi) — nom yoniga «1-bino»,
//     «2-bino» (`buildingNo`): oylik, kassa va xodim davomati bino bo'yicha.

/**
 * Tanlov ro'yxatida hovuzni BITTA qatorga yig'adi (tartib saqlanadi).
 * Hovuzdan `prefer` (masalan joriy navbar filiali) ro'yxatda bo'lsa — o'sha
 * qoladi, aks holda hovuzdan ro'yxatda birinchi uchragani.
 */
export function collapseBranchPools<T extends { id: number }>(list: readonly T[], prefer?: number | null): T[] {
  const out: T[] = [];
  const seen = new Set<number>();
  for (const b of list) {
    const pool = branchPool(b.id);
    if (pool.length < 2) {
      out.push(b);
      continue;
    }
    if (seen.has(pool[0])) continue;
    seen.add(pool[0]);
    const preferred = prefer != null && pool.includes(prefer) ? list.find((x) => x.id === prefer) : undefined;
    out.push(preferred ?? b);
  }
  return out;
}

/** Hovuzdagi bino raqami (1, 2 …); hovuzsiz filialda `null`. */
export function buildingNo(branchId: number): number | null {
  const pool = branchPool(branchId);
  return pool.length < 2 ? null : pool.indexOf(branchId) + 1;
}

/**
 * Bino kerak joylar uchun yorliq: «Akademiya Chortoq · 2-bino». `word` —
 * tarjima qilingan «{n}-bino» (`(n) => t("{n}-bino", { n })`).
 */
export function branchBuildingLabel(b: { id: number; name: string }, word: (n: number) => string): string {
  const n = buildingNo(b.id);
  return n === null ? b.name : `${b.name} · ${word(n)}`;
}
