import type { Db } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope, type BranchScope } from "@/lib/branchScope";
import { employeeNameById } from "@/lib/currentEmployee";
import { isPathAllowed } from "@/lib/permissions";
import { uzDateIso } from "@/lib/uzTime";

// SAVOL BERAYOTGAN XODIM — vositalar uchun yagona kontekst.
//
// So'rov BOSHIDA bir marta yig'iladi va vositalarga ANIQ uzatiladi.
// Vositalar `getBranchScope()` / `getCurrentUser()` ni o'zi chaqirmaydi:
// javob oqim (stream) bo'lib ketadi va vositalar route qaytgandan keyin
// ishlaydi — cookie'ga bog'liq funksiyalarni o'sha paytda chaqirishga
// tayanmaymiz. Ustiga, har vosita qamrovni qaytadan yechsa, bitta savol
// ichida ikki xil filial chiqib qolishi mumkin edi (boshqa oynada filial
// almashtirilsa).

export interface AiContext {
  db: Db;
  userId: string;
  /** `users.fullName` — salomlashish va javobda murojaat uchun. */
  userName: string;
  /**
   * `hr_employees.name` — kassa egaligi (`cashboxes.moderator`) va lid
   * muallifi shu ism bilan solishtiriladi (lib/currentEmployee.ts). Bo'sh
   * bo'lishi mumkin (hisob xodimlar ro'yxatiga bog'lanmagan).
   */
  employeeName: string;
  isAdmin: boolean;
  /** `null` — cheklov yo'q (lib/permissions.ts). */
  permissions: string[] | null;
  scope: BranchScope;
  branchName: string;
  /** Toshkent kuni, "YYYY-MM-DD". */
  today: string;
  /** Xodim shu sahifani ko'ra oladimi — vositalar ruxsati shu bilan kesiladi. */
  can: (href: string) => boolean;
  /**
   * Amallar (qoralama + tasdiq) yoqilganmi — Sozlamalardagi alohida kalit
   * (lib/ai/settings.ts → actionsEnabled). O'chiq bo'lsa amal vositalari
   * modelga umuman ko'rsatilmaydi.
   */
  actions: boolean;
}

/** `null` — tizimga kirilmagan yoki sessiya amal qilmaydi. */
export async function loadAiContext(db: Db, opts: { actions?: boolean } = {}): Promise<AiContext | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  const scope = await getBranchScope();
  if (!scope) return null;

  const [employeeName, branch] = await Promise.all([
    employeeNameById(db, me.hrEmployeeId),
    db.collection("branches").findOne({ id: scope.branchId }, { projection: { _id: 0, name: 1 } }),
  ]);

  const permissions = me.permissions;
  return {
    db,
    userId: me.id,
    userName: String(me.fullName ?? "").trim(),
    employeeName,
    isAdmin: me.role === "admin",
    permissions,
    scope,
    branchName: String(branch?.name ?? "").trim() || `#${scope.branchId}`,
    today: uzDateIso(),
    can: (href) => isPathAllowed(href, permissions),
    actions: opts.actions === true,
  };
}

/**
 * Lid qamrovining muallif yarmi (lib/leadScope.ts) — `currentAuthorName()`
 * bilan bir xil qoida: xodim ismi, bo'lmasa hisob nomi.
 */
export function authorNameOf(ctx: AiContext): string {
  return ctx.employeeName || ctx.userName;
}
