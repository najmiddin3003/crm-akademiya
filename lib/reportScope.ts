import type { BranchScope } from "@/lib/branchScope";
import { branchPool, expandBranchPools, sameBranchPool } from "@/lib/branchPools";

// Hisobotlar (15-qism) — `?branch=` parametri: «Barchasi» (xodimga ruxsat etilgan hamma
// filial) yoki bitta filial (1+2 hovuzi birga). BranchScope'da «barcha filiallar» rejimi
// yo'q (lib/branchScope.ts izohi) — bu faqat O'QIYDIGAN hisobotlar uchun: hech narsa
// yozilmaydi, shuning uchun «qaysi filialga yozildi» muammosi tug'ilmaydi.

export interface ReportBranch {
  /** Filtrga tushadigan filial id'lari (hovuz ochilgan). */
  ids: number[];
  /** "all" yoki tanlangan filial. */
  branch: "all" | number;
}

/** `null` — so'ralgan filial xodimga biriktirilmagan. */
export function reportBranchIds(scope: BranchScope, raw: string | null): ReportBranch | null {
  const v = (raw ?? "").trim();
  if (!v || v === "all") return { ids: expandBranchPools(scope.allowed), branch: "all" };
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || !scope.allowed.some((a) => sameBranchPool(a, n))) return null;
  return { ids: [...branchPool(n)], branch: n };
}

export const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
