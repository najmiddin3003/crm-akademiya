import type { Db } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope, type BranchScope } from "@/lib/branchScope";
import { employeeNameById } from "@/lib/currentEmployee";
import { isPathAllowed } from "@/lib/permissions";
import { loadViewer, type StaffTaskViewer } from "@/lib/staffTasksServer";
import { uzDateIso } from "@/lib/uzTime";
import { branchPool } from "@/lib/branchPools";

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
  /** `users.hrEmployeeId` — topshiriqlar qamrovi shunga qaraydi; hisob bog'lanmagan bo'lsa null. */
  employeeId: number | null;
  isAdmin: boolean;
  /** `null` — cheklov yo'q (lib/permissions.ts). */
  permissions: string[] | null;
  scope: BranchScope;
  branchName: string;
  /**
   * Joriy filial bilan bitta HOVUZdagi boshqa filiallar nomi (lib/branchPools.ts,
   * 09.10.2026: 1+2 kassa va oylikdan boshqa hamma joyda bitta). Bo'sh — hovuz yo'q.
   */
  poolBranchNames?: string[];
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
  /**
   * So'rov boshlangan vaqt. Shu so'rovda tuzilgan qoralamalar bundan keyin,
   * oldingi javoblardagilar oldin — eskisini almashtirishda ajratiladi
   * (lib/ai/actions/store.ts → supersedeDrafts).
   */
  startedAt: Date;
}

/** `null` — tizimga kirilmagan yoki sessiya amal qilmaydi. */
export async function loadAiContext(db: Db, opts: { actions?: boolean } = {}): Promise<AiContext | null> {
  const startedAt = new Date();
  const me = await getCurrentUser();
  if (!me) return null;
  const scope = await getBranchScope();
  if (!scope) return null;

  const pool = branchPool(scope.branchId);
  const [employeeName, branch, poolRows] = await Promise.all([
    employeeNameById(db, me.hrEmployeeId),
    db.collection("branches").findOne({ id: scope.branchId }, { projection: { _id: 0, name: 1 } }),
    pool.length > 1
      ? db.collection("branches").find({ id: { $in: pool.filter((b) => b !== scope.branchId) } }, { projection: { _id: 0, name: 1 } }).toArray()
      : Promise.resolve([]),
  ]);

  const permissions = me.permissions;
  return {
    db,
    userId: me.id,
    userName: String(me.fullName ?? "").trim(),
    employeeName,
    employeeId: me.hrEmployeeId,
    isAdmin: me.role === "admin",
    permissions,
    scope,
    branchName: String(branch?.name ?? "").trim() || `#${scope.branchId}`,
    poolBranchNames: poolRows.map((b) => String(b.name ?? "").trim()).filter(Boolean),
    today: uzDateIso(),
    can: (href) => isPathAllowed(href, permissions),
    actions: opts.actions === true,
    startedAt,
  };
}

/**
 * Lid qamrovining muallif yarmi (lib/leadScope.ts) — `currentAuthorName()`
 * bilan bir xil qoida: xodim ismi, bo'lmasa hisob nomi.
 */
export function authorNameOf(ctx: AiContext): string {
  return ctx.employeeName || ctx.userName;
}

/**
 * Topshiriqlarda kim nimani ko'radi va kim beradi — /tasks sahifasi bilan
 * BIR XIL qoida (lib/staffTasksServer.ts → loadViewer): direktor — hammasi,
 * rahbar (/tasks ruxsati) — o'z filiallari, xodim — faqat o'ziga berilgan.
 */
export function taskViewerOf(ctx: AiContext): Promise<StaffTaskViewer> {
  return loadViewer(ctx.db, {
    id: ctx.userId,
    // loadViewer faqat "admin" ni ajratadi — qolgan rollar bir xil.
    role: ctx.isAdmin ? "admin" : "employee",
    permissions: ctx.permissions,
    hrEmployeeId: ctx.employeeId ?? null,
    fullName: ctx.userName,
  });
}
