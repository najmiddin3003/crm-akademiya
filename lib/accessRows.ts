import { ALL_PERMISSION_PATHS, PERMISSION_GROUPS } from "@/lib/permissions";

// ROLLAR VA HUQUQLAR JADVALI QATORLARI (25-qism, rasm «Rollar va huquqlar», 13.11.2026).
//
// Ruxsat tizimi o'zgarmadi: rolga va xodimga SAHIFALAR ro'yxati beriladi (lib/permissions.ts,
// `null` — cheklovsiz). Rasmdagi jadval esa ~20 qatordan iborat («Lidlar», «Moliya · Oylik» …),
// har qator bir nechta sahifani o'z ichiga oladi. Bu fayl sahifalarni qatorlarga bo'ladi va
// qator darajasini hisoblaydi:
//   full    — qatordagi hamma sahifa ochiq («To'liq»);
//   partial — bir qismi («Qisman 2/5»; qator ochilsa sahifalar alohida ko'rinadi);
//   none    — hech biri («Yo'q» — menyuda ko'rinmaydi);
//   own     — faqat «Topshiriqlar»: ruxsatsiz xodim ham o'z topshirig'ini ko'radi
//             (lib/permissions.ts → SELF_SERVICE_PATHS), ruxsat — berish va nazorat.
// Rasmdagi «Ko'rish» (faqat ko'radi, o'zgartirmaydi) darajasi tizimda YO'Q — sahifa ochiq yoki
// yopiq (design/v2/SAVOLLAR.md, 25-qism).
//
// HAR SAHIFA BITTA QATORDA: ba'zi sahifalar menyuda ikki joyda turadi (masalan «Kirim chiqim» —
// Moliya va Hisobotlarda), lekin ruxsat kaliti bitta. Ikki qatorda tursa, birini o'zgartirish
// ikkinchisini ham jimgina o'zgartirardi — shu bois sahifa birinchi uchragan qatorga tushadi.
//
// Menyuga yangi bo'lim qo'shilsa (constants/sidebar.js) u yo'qolmaydi — «Boshqa» bo'limiga
// o'z qatori bilan tushadi.

export type RowKind =
  /** Oddiy qator — sahifalar ro'yxatidan. */
  | "normal"
  /** «Topshiriqlar» — ruxsatsiz ham o'zinikini ko'radi. */
  | "self"
  /** Hammaga ochiq sahifalar (Gamifikatsiya — ichida rol bo'yicha kesiladi). */
  | "always"
  /** Faqat administrator (Amallar jurnali, Vaqtinchalik bo'lim) — rollarga berilmaydi. */
  | "admin";

export type RowLevel = "full" | "partial" | "none" | "own";

export interface AccessPage {
  href: string;
  label: string;
}

export interface AccessRow {
  key: string;
  label: string;
  /** Qator ostidagi kulrang izoh. */
  hint: string;
  /** Bo'lim sarlavhasi (jadvaldagi kulrang ajratgich). */
  section: string;
  kind: RowKind;
  /** Belgilanadigan sahifalar (ruxsat kalitlari). `always`/`admin` da bo'sh. */
  pages: AccessPage[];
}

/** Moliya bo'limi rasmdagidek bir necha qatorga bo'linadi; ro'yxatda yo'q sahifa — «Kassalar» qatoriga. */
const FINANCE_SPLIT: { key: string; label: string; hint: string; paths: string[] }[] = [
  {
    key: "finance-cash",
    label: "Moliya · Kassalar",
    hint: "kirim, chiqim, ko'chirish, tranzaksiyalar",
    paths: ["/finance-cash", "/finance-cashflow", "/finance-transactions", "/finance-tx-types", "/finance-planned", "/finance-fin-contract", "/finance-sync"],
  },
  { key: "finance-payroll", label: "Moliya · Oylik", hint: "oylik, avans, bonus, jarima", paths: ["/finance-payroll", "/finance-bonus", "/finance-penalty"] },
  {
    key: "finance-analytics",
    label: "Moliya · Tahlil",
    hint: "tushum rejasi, analitika, P&L, pul oqimi",
    paths: ["/finance-revenue-plan", "/finance-analytics", "/finance-reports", "/finance-pnl", "/finance-flow"],
  },
];

/** Menyu bo'limi (constants/sidebar.js kaliti) → jadvaldagi joyi va izohi. Tartib — jadval tartibi. */
const GROUP_META: { key: string; section: string; label?: string; hint: string }[] = [
  { key: "tasks", section: "Kundalik ish", hint: "berish va nazorat" },
  { key: "leads", section: "O'quv jarayoni", hint: "buyurtmalar, birinchi dars" },
  { key: "groups", section: "O'quv jarayoni", hint: "guruhlar, dars jadvali, xonalar" },
  { key: "students", section: "O'quv jarayoni", hint: "ro'yxat, kartasi, ota-ona" },
  { key: "education", section: "O'quv jarayoni", hint: "kurslar, kategoriya, shartnoma" },
  { key: "imtihon", section: "O'quv jarayoni", hint: "Sarhisob" },
  { key: "blok-test", section: "O'quv jarayoni", hint: "blok test turlari va natijalari" },
  { key: "gamification", section: "O'quv jarayoni", hint: "reyting, do'kon" },
  { key: "finance", section: "Moliya va sotuv", hint: "" },
  { key: "sales", section: "Moliya va sotuv", hint: "reklama, SMS, xabarlar" },
  { key: "reports", section: "Moliya va sotuv", hint: "voronka, qarzdorlar, samaradorlik" },
  { key: "boshqaruv", section: "Jamoa va nazorat", hint: "xodimlar, ishga qabul, rollar" },
  { key: "nazorat", section: "Jamoa va nazorat", hint: "davomat, ishga keldim, reyting" },
  { key: "settings", section: "Tizim", hint: "markaz, moliya, o'quv sozlamalari" },
];

/** Faqat administratorga — rollar oynasiga tushmaydi (lib/permissions.ts → adminOnly). */
const ADMIN_ROWS: AccessRow[] = [
  { key: "action-log", label: "Amallar jurnali", hint: "kim, qachon, nima qilgani", section: "Tizim", kind: "admin", pages: [] },
  { key: "temp", label: "Vaqtinchalik bo'lim", hint: "loginlar, SMS taklif, ish vaqti", section: "Tizim", kind: "admin", pages: [] },
];

function buildRows(): AccessRow[] {
  const groups = new Map(PERMISSION_GROUPS.map((g) => [g.key, g]));
  const rows: AccessRow[] = [];

  // Sahifa egasi — MENYU tartibida birinchi uchragan bo'lim (jadval tartibida emas): «Filiallar
  // holati» Nazorat'niki, Hisobotlar'da takror turadi.
  const owned = new Map<string, AccessPage[]>();
  const taken = new Set<string>();
  for (const g of PERMISSION_GROUPS) {
    const out: AccessPage[] = [];
    for (const item of g.items) {
      if (item.always || taken.has(item.href)) continue;
      taken.add(item.href);
      out.push({ href: item.href, label: item.label });
    }
    owned.set(g.key, out);
  }
  const pagesOf = (key: string): AccessPage[] => owned.get(key) ?? [];

  const push = (key: string, section: string, label: string, hint: string) => {
    const g = groups.get(key);
    if (!g) return;
    const allAlways = g.items.length > 0 && g.items.every((i) => i.always);
    if (allAlways) {
      rows.push({ key, label, hint, section, kind: "always", pages: [] });
      return;
    }
    if (key === "finance") {
      const pages = pagesOf(key);
      const byPath = new Map(pages.map((p) => [p.href, p]));
      const used = new Set<string>();
      FINANCE_SPLIT.forEach((part, i) => {
        const own = part.paths.map((p) => byPath.get(p)).filter((p): p is AccessPage => Boolean(p));
        own.forEach((p) => used.add(p.href));
        // Ro'yxatda yo'q (keyin qo'shilgan) moliya sahifasi — birinchi qatorga.
        if (i === 0) own.push(...pages.filter((p) => !FINANCE_SPLIT.some((s) => s.paths.includes(p.href))));
        if (own.length) rows.push({ key: part.key, label: part.label, hint: part.hint, section, kind: "normal", pages: own });
      });
      return;
    }
    const pages = pagesOf(key);
    if (pages.length === 0) return;
    const self = g.items.some((i) => i.selfService);
    rows.push({ key, label, hint, section, kind: self ? "self" : "normal", pages });
  };

  for (const meta of GROUP_META) push(meta.key, meta.section, meta.label ?? groups.get(meta.key)?.label ?? meta.key, meta.hint);
  // Ro'yxatda yo'q bo'lim (menyuga keyin qo'shilgan) — yo'qolmasin.
  for (const g of PERMISSION_GROUPS) {
    if (GROUP_META.some((m) => m.key === g.key)) continue;
    push(g.key, "Boshqa", g.label, "");
  }
  // Tizim bo'limining oxiriga — faqat admin qatorlari.
  const lastSystem = rows.map((r) => r.section).lastIndexOf("Tizim");
  rows.splice(lastSystem >= 0 ? lastSystem + 1 : rows.length, 0, ...ADMIN_ROWS);
  return rows;
}

export const ACCESS_ROWS: AccessRow[] = buildRows();

/** Jadvaldagi bo'limlar tartibi bilan. */
export const ACCESS_SECTIONS: { title: string; rows: AccessRow[] }[] = (() => {
  const out: { title: string; rows: AccessRow[] }[] = [];
  for (const row of ACCESS_ROWS) {
    const last = out[out.length - 1];
    if (last && last.title === row.section) last.rows.push(row);
    else out.push({ title: row.section, rows: [row] });
  }
  return out;
})();

/** Rol yoki xodimga beriladigan qatorlar (admin va «hammaga ochiq» qatorlar emas). */
export const GRANTABLE_ROWS = ACCESS_ROWS.filter((r) => r.kind === "normal" || r.kind === "self");

export function rowByKey(key: string): AccessRow | undefined {
  return ACCESS_ROWS.find((r) => r.key === key);
}

/** Bo'lim ruxsati: ro'yxat yoki `null` (cheklovsiz). */
export type Access = string[] | null;

export interface RowState {
  level: RowLevel;
  /** Ochiq sahifalar soni (`partial` uchun «2/5»). */
  on: number;
  total: number;
}

/** Qator darajasi berilgan ruxsat ro'yxati uchun. `admin` — administratormi (hammasi ochiq). */
export function rowState(row: AccessRow, access: Access, admin = false): RowState {
  const total = row.pages.length;
  if (row.kind === "always") return { level: "full", on: total, total };
  if (row.kind === "admin") return { level: admin ? "full" : "none", on: 0, total };
  if (admin || access === null) return { level: "full", on: total, total };
  const have = new Set(access);
  const on = row.pages.filter((p) => have.has(p.href)).length;
  if (row.kind === "self") return { level: on > 0 ? "full" : "own", on, total };
  return { level: on === 0 ? "none" : on === total ? "full" : "partial", on, total };
}

/** Darajalar tartibi (kengaytirildimi yoki toraytirildimi — farq belgisida). */
export function levelRank(level: RowLevel): number {
  return level === "full" ? 3 : level === "partial" ? 2 : level === "own" ? 1 : 0;
}

/**
 * Qatorni «To'liq» yoki «Yo'q» qiladi (qolgan qatorlarga tegmaydi). `null` (cheklovsiz) dan
 * boshlansa — avval barcha sahifalar ro'yxatiga yoyiladi.
 */
export function setRowLevel(access: Access, row: AccessRow, on: boolean): string[] {
  const base = new Set(access === null ? ALL_PERMISSION_PATHS : access);
  for (const p of row.pages) {
    if (on) base.add(p.href);
    else base.delete(p.href);
  }
  return [...base];
}

/** Bitta sahifani yoqadi/o'chiradi (qator ochilganda). */
export function setPage(access: Access, href: string, on: boolean): string[] {
  const base = new Set(access === null ? ALL_PERMISSION_PATHS : access);
  if (on) base.add(href);
  else base.delete(href);
  return [...base];
}

/**
 * ROL uchun saqlanadigan qiymat: hamma sahifa belgilangan bo'lsa `null` («cheklovsiz» — menyuga
 * keyin qo'shiladigan sahifalar ham avtomatik ochiq, eski Rollar sahifasidagi qoida). Xodimning
 * alohida ruxsatida bunday aylantirish QILINMAYDI (lib/rolePermissions.ts izohi).
 */
export function roleAccessToSave(access: string[]): Access {
  const have = new Set(access);
  return ALL_PERMISSION_PATHS.every((p) => have.has(p)) ? null : access;
}

/** Ikki ruxsat ro'yxati bir xilmi (tartibsiz). */
export function sameAccess(a: Access, b: Access): boolean {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export interface RowDiff {
  row: AccessRow;
  /** Rolda. */
  from: RowState;
  /** Xodimda. */
  to: RowState;
  /** «Qo'shildi» (kengroq) yoki «Cheklandi» (torroq). */
  kind: "add" | "restrict";
}

/**
 * Xodimning alohida ruxsati roldan qaysi qatorlarda farq qiladi (rasm «Alohida ruxsat» panelidagi
 * «Qo'shildi / Cheklandi» ro'yxati). Bir xil darajada, lekin boshqa sahifalar (Qisman 2/5 va 2/5)
 * bo'lsa ham farq — `on` va sahifalar solishtiriladi.
 */
export function accessDiff(roleAccess: Access, own: Access): RowDiff[] {
  const out: RowDiff[] = [];
  for (const row of GRANTABLE_ROWS) {
    const from = rowState(row, roleAccess);
    const to = rowState(row, own);
    const fromSet = roleAccess === null ? null : new Set(roleAccess);
    const toSet = own === null ? null : new Set(own);
    const differs = row.pages.some((p) => (fromSet === null || fromSet.has(p.href)) !== (toSet === null || toSet.has(p.href)));
    if (!differs) continue;
    const kind = levelRank(to.level) > levelRank(from.level) || (to.level === from.level && to.on >= from.on) ? "add" : "restrict";
    out.push({ row, from, to, kind });
  }
  return out;
}

/** Qatorni roldagi holatiga qaytaradi (alohida ruxsatdagi farqni olib tashlash). */
export function revertRow(own: string[], roleAccess: Access, row: AccessRow): string[] {
  const base = new Set(own);
  const roleSet = roleAccess === null ? null : new Set(roleAccess);
  for (const p of row.pages) {
    if (roleSet === null || roleSet.has(p.href)) base.add(p.href);
    else base.delete(p.href);
  }
  return [...base];
}
