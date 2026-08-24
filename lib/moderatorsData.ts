// Moderatorlar — Boshqaruv → Xodimlar roster'idagi (MongoDB `hr_employees`)
// `turi: "moderator"` yozuvlari. O'qituvchilardagi kabi alohida kolleksiya
// YO'Q: moderator ham xodim (lib/teachersData.ts bilan bir xil yondashuv).
//
// Ilgari moderator tanlanadigan joylar yo qattiq yozilgan ro'yxatdan, yo
// butun xodimlar ro'yxatini klientga tortib olib, o'sha yerda filtrlashdan
// oldinlardi. Endi moderator kerak bo'lgan har qanday joy /api/moderators
// dan (klientda hooks/useModerators.ts orqali) o'qiydi.

import type { HrEmployee } from "@/lib/hrEmployees";

export interface Moderator {
  id: number;
  name: string;
  phone: string;
  filial: string;
  photoUrl?: string;
}

/** Xodim yozuvi — faol (arxivlanmagan) moderatormi. */
export function isActiveModerator(e: Pick<HrEmployee, "turi" | "archReason">): boolean {
  return e.turi === "moderator" && !e.archReason;
}

export function moderatorFromEmployee(e: HrEmployee): Moderator {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone ?? "",
    filial: e.filial ?? "",
    photoUrl: e.photoUrl,
  };
}
