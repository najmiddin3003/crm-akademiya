import { GROUP_DAYS } from "@/constants/groups";
import { groupWeekdays } from "@/lib/attendance";

// Guruhning dars kunlari qiymati (`groups.day`) — formadagi «istalgan kunlar»
// tugmalari uchun (components/groups/GroupDaysField.tsx, 28.09.2026).

/** Dushanbadan yakshanbagacha; `wd` — JS hafta kuni (0 = yakshanba). */
export const GROUP_WEEK = [
  { wd: 1, abbr: "Du", long: "Dushanba" },
  { wd: 2, abbr: "Se", long: "Seshanba" },
  { wd: 3, abbr: "Ch", long: "Chorshanba" },
  { wd: 4, abbr: "Pa", long: "Payshanba" },
  { wd: 5, abbr: "Ju", long: "Juma" },
  { wd: 6, abbr: "Sh", long: "Shanba" },
  { wd: 0, abbr: "Ya", long: "Yakshanba" },
] as const;

const setKey = (days: readonly number[]) => [...days].sort((a, b) => a - b).join(",");

/**
 * Kunlar to'plami → saqlanadigan qiymat. Biror tayyor variantga (GROUP_DAYS)
 * teng bo'lsa o'sha NOM (Du+Ch+Ju → «Toq kunlar») — filtrlar va hisobotlar
 * bir xil jadvalni bir nom bilan ko'rsin; aks holda qisqartmalar dushanbadan
 * boshlab vergul bilan ("Du,Ch,Sh"), `groupWeekdays` ularni tushunadi.
 */
export function groupDayValue(days: readonly number[]): string {
  if (days.length === 0) return "";
  const key = setKey(days);
  const preset = GROUP_DAYS.find((p) => setKey(groupWeekdays(p)) === key);
  if (preset) return preset;
  return GROUP_WEEK.filter((d) => days.includes(d.wd)).map((d) => d.abbr).join(",");
}
