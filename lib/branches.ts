import { BRANCHES_METRICS, BRANCHES_DATA } from "@/constants/branches";

export interface BranchMetric {
  id: string;
  label: string;
  decimal?: boolean;
}

export interface BranchRow {
  id: number;
  name: string;
  vals: Record<string, number>;
}

const METRICS = BRANCHES_METRICS as BranchMetric[];
const DATA = BRANCHES_DATA as BranchRow[];

export function branchTotals(): Record<string, number> {
  const totals: Record<string, number> = {};
  METRICS.forEach((m) => { totals[m.id] = 0; });
  DATA.forEach((b) => {
    METRICS.forEach((m) => { totals[m.id] += b.vals[m.id] || 0; });
  });
  return totals;
}

export function fmtBranchVal(v: number, decimal?: boolean): string {
  return decimal ? v.toFixed(1) : v.toLocaleString("ru-RU").replace(/,/g, " ");
}
