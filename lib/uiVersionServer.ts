import { cookies } from "next/headers";
import type { Db } from "mongodb";
import { ROLE_LABELS } from "@/constants/employees";
import { normalizeUiVersion, UI_COOKIE, type UiVersion } from "@/lib/uiVersion";

// Versiya almashtirgichining server qismi (lib/uiVersion.ts izohi).

/**
 * Almashtirgich shu serverda yoqilganmi.
 *
 * SUKUT: faqat sinov saytida (Vercel — `VERCEL=1` ni Vercel o'zi qo'yadi,
 * proxy.ts dagi qo'riqchi ham shunga tayanadi) va lokal dev'da. PROD VPS'da
 * bu o'zgaruvchilar yo'q — u yerda hamma eski versiyani ko'radi, cookie
 * qo'lda yozilsa ham. Ya'ni yangi versiya kodi main'ga tushib, prod'ga
 * deploy qilinsa ham ishlatuvchilar hech narsani sezmaydi.
 *
 * Qo'lda boshqarish: `UI_V2_SWITCH=on` (masalan prod'da adminlarga ochish
 * vaqti kelganda) yoki `UI_V2_SWITCH=off` (sinov saytida o'chirish).
 */
export function uiSwitchEnabled(): boolean {
  const flag = (process.env.UI_V2_SWITCH || "").trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "development";
}

/** Joriy so'rov uchun versiya. Almashtirgich o'chiq bo'lsa — doim eski. */
export async function currentUiVersion(): Promise<UiVersion> {
  if (!uiSwitchEnabled()) return "v1";
  return normalizeUiVersion((await cookies()).get(UI_COOKIE)?.value);
}

/**
 * Yangi yuqori paneldagi ism ostidagi lavozim (dizayn: «Asadbek Karimov ·
 * Administrator»). Faqat yangi versiyada chaqiriladi — eski qobiqqa
 * qo'shimcha so'rov yo'q.
 *
 * Manba xodimlar ro'yxatidagi bilan bir xil (components/employees/useRoleNames.ts
 * → employeeRoleLabel): qo'lda qo'shilgan rol — Rollar'dagi nomi, aks holda
 * `hr_employees.turi` yorlig'i. Topilmasa — umumiy «Xodim».
 */
export async function shellRoleLabel(db: Db, user: { role: string; hrEmployeeId: number | null }): Promise<string> {
  const labels = ROLE_LABELS as Record<string, string>;
  if (user.role === "admin") return labels.admin;
  if (user.hrEmployeeId === null) return labels.staff;
  const emp = await db
    .collection("hr_employees")
    .findOne({ id: user.hrEmployeeId }, { projection: { turi: 1, centerRoleId: 1 } });
  if (!emp) return labels.staff;
  if (emp.centerRoleId !== null && emp.centerRoleId !== undefined) {
    const role = await db.collection("roles").findOne({ id: Number(emp.centerRoleId) }, { projection: { name: 1 } });
    const name = typeof role?.name === "string" ? role.name.trim() : "";
    return name || labels.staff;
  }
  return labels[String(emp.turi ?? "")] ?? labels.staff;
}
