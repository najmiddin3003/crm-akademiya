import type { CurrentUser } from "@/lib/auth";
import { ADMIN_ROLE } from "@/lib/employeeRoleSync";
import { PERMISSION_GROUPS } from "@/lib/permissions";

// RUXSAT BERISH QOIDASI — «O'ZIDA BORINI BERADI» (02.11.2026, egasining tanlovi).
//
// NEGA KERAK: bo'lim ruxsatini o'zgartiradigan route'lar faqat bo'lim bilan to'silgan edi
// (proxy, lib/apiPermissions.generated.ts). Natijada Xodimlar bo'limi ochiq, admin bo'lmagan
// xodim PATCH /api/hr-employees/:id orqali o'z yozuviga alohida ro'yxat
// (`hr_employees.permissions`, lavozimdan USTUN) yoki bo'sh lavozim yozib butun CRM'ni ochib
// olardi; POST /api/roles bilan hamma bo'limli rol yaratib, uni o'ziga berardi; Rollar bo'limi
// ochiq xodim o'z rolini kengaytirardi. Admin API'lari (lib/adminOnly.ts) yopiq qolardi — bu
// bo'lim darajasidagi teshik.
//
// QOIDA — admin va cheklovsiz xodim (ruxsati `null`) hammasini bera oladi; qolganlar:
//   • O'ZIGA yangi bo'lim ocha olmaydi — lavozim, rol, alohida ruxsat orqali ham (faqat
//     toraytirish mumkin);
//   • boshqa xodimga ALOHIDA RUXSAT va Rollar'dagi ROL RO'YXATI — faqat o'zida bor bo'limlar;
//   • LAVOZIM yoki ROL berish (o'qituvchi, moderator, Rollar'dagi rol) — avvalgidek: o'qituvchi
//     qo'shadigan xodimda o'qituvchi bo'limlari bo'lishi shart emas. Faqat natijasi «cheklovsiz»
//     bo'lsa (bo'sh yoki noma'lum lavozim, ro'yxatsiz rol) — yo'q.
// Faqat QO'SHILAYOTGAN qism tekshiriladi: xodimda allaqachon bor bo'limni saqlab qolish yoki
// olib tashlash cheklanmaydi. Administrator lavozimi — alohida qoida (lib/employeeRoleSync.ts).
//
// QAYERDA: PATCH /api/hr-employees/:id, lib/hrEmployeeCreate.ts (POST /api/hr-employees va CV'dan
// ishga olish), POST /api/roles, PATCH /api/roles/:id. /vaqtinchalik — faqat admin, tegilmaydi.

/** Bo'lim ruxsati: ro'yxat yoki `null` — cheklovsiz (lib/permissions.ts semantikasi). */
export type Access = string[] | null;

export type GrantCheck = { ok: true } | { ok: false; status: 403; error: string };

const OK: GrantCheck = { ok: true };

/**
 * So'rov egasi bera oladigan doira. Admin — cheklovsiz (uning `permissions` i ham `null`, lekin
 * adminlik `users.role` dan aniqlanadi — lib/adminOnly.ts bilan bir xil). Sessiyasiz — hech narsa.
 */
export function grantorAccess(me: Pick<CurrentUser, "role" | "permissions"> | null): Access {
  if (!me) return [];
  return me.role === ADMIN_ROLE ? null : me.permissions;
}

/** `before` → `after` da QO'SHILAYOTGAN qism: bo'limlar yoki "all" (cheklovsiz qilish). */
export function addedAccess(before: Access, after: Access): string[] | "all" {
  if (after === null) return before === null ? [] : "all";
  if (before === null) return []; // cheklovsizdan ro'yxatga — faqat toraytirish
  const had = new Set(before);
  return after.filter((k) => !had.has(k));
}

/** Qo'shilayotgan qismdan beruvchining o'zida YO'G'i; [] — hammasi joyida. */
function beyondGrantor(grantor: Access, added: string[] | "all"): string[] | "all" {
  if (grantor === null) return [];
  if (added === "all") return "all";
  const own = new Set(grantor);
  return added.filter((k) => !own.has(k));
}

/** Bo'lim kaliti → sidebardagi nomi (xabar uchun). Takrorlanganda birinchisi. */
const SECTION_LABELS = new Map<string, string>();
for (const item of PERMISSION_GROUPS.flatMap((g) => g.items)) {
  if (!SECTION_LABELS.has(item.href)) SECTION_LABELS.set(item.href, item.label);
}
const labelsOf = (keys: string[]) => keys.map((k) => SECTION_LABELS.get(k) ?? k).join(", ");

/**
 * Xodim ruxsatiga ta'sir qiladigan o'zgarish (lavozim, rol, alohida ruxsat).
 *
 *   self     — xodim so'rov egasining o'zi (lib/employeeRoleSync.ts → isOwnRecord);
 *   personal — alohida ruxsat (`hr_employees.permissions`) o'zgaryapti;
 *   before / after — xodimning bo'lim ruxsati o'zgarishdan oldin va keyin
 *                    (lib/rolePermissions.ts → employeePermissions); yangi xodimda before = [].
 */
export function checkEmployeeGrant(
  grantor: Access,
  change: { self: boolean; personal: boolean; before: Access; after: Access },
): GrantCheck {
  if (grantor === null) return OK;
  const added = addedAccess(change.before, change.after);
  if (added !== "all" && added.length === 0) return OK;
  if (change.self) {
    return { ok: false, status: 403, error: "O'zingizga yangi bo'lim ocha olmaysiz — buni admin qilsin" };
  }
  const over = change.personal ? beyondGrantor(grantor, added) : added === "all" ? "all" : [];
  if (over === "all") {
    return {
      ok: false,
      status: 403,
      error: "Lavozimsiz yoki cheklovsiz rolli xodim barcha bo'limlarni ko'radi — boshqa lavozim tanlang yoki buni admin qilsin",
    };
  }
  if (over.length === 0) return OK;
  const sections = labelsOf(over);
  return { ok: false, status: 403, error: `O'zingizda yo'q bo'limni bera olmaysiz: ${sections}` };
}

/** Rol ro'yxati o'zgarishi (Boshqaruv → Rollar). Yangi rolda before = []. */
export function checkRoleGrant(grantor: Access, before: Access, after: Access): GrantCheck {
  const over = beyondGrantor(grantor, addedAccess(before, after));
  if (over === "all") {
    return { ok: false, status: 403, error: "Hamma bo'lim belgilangan rol cheklovsiz bo'ladi — buni admin qilsin" };
  }
  if (over.length === 0) return OK;
  const sections = labelsOf(over);
  return { ok: false, status: 403, error: `Rolga o'zingizda yo'q bo'limni qo'sha olmaysiz: ${sections}` };
}
