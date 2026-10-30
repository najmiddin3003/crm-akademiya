import { LOG_CATEGORIES, LOG_FIELD_LABELS, LOG_VERBS, sectionLabel, type LogCategory, type LogVerbKey } from "./actionLogLabels";
import { HOLATLAR } from "./leadHolat";

// «AMALLAR JURNALI» — YOZUVNI ODAM TILIDA KO'RSATISH (25.10.2026, 14-qism; rasm «Amallar jurnali»).
//
// Bazada xom yozuv turadi (lib/actionLog.ts): kim, qaysi API yo'li, usul, yuborilgan tana, bot
// tafsilotlari va — tahrir/o'chirishda — proxy olgan ESKI holat (`before`, lib/actionLogSnapshot.ts).
// Bu fayl undan ekrandagi qatorni yasaydi: «Sarkor Shukurjonov kirim qo'shdi — Muxlisa Xoshimjanova»,
// «Moliya · Naqd · kassa: Akademiya 4 Uchqo'rg'on», «+300 000 so'm», tahrirda «oldin → keyin».
// SOF funksiyalar (baza yo'q): nomlar (kassa, guruh, o'quvchi …) chaqiruvchi bergan `LogNames` dan —
// GET /api/action-log/feed ularni bir sahifa uchun bitta so'rovda yig'adi. Matnlar o'zbekcha kalit
// (`LogText.k`) yoki ma'lumot (`LogText.v`) — sahifa kalitni `t()` bilan o'giradi.

export type LogIcon = "login" | "logout" | "in" | "out" | "move" | "pupil" | "group" | "lead" | "attendance" | "staff" | "delete" | "other" | "denied";

/** Bazadagi yozuv (API javobidagi shakl: `_id` → `id`, `at` — ISO). */
export interface LogRow {
  id: string;
  at: string;
  actor: { kind?: string; userId?: string | null; employeeId?: number | null; name?: string | null; role?: string | null; phone?: string | null; tgId?: number | null };
  source?: string;
  section: string;
  action: string;
  path?: string;
  query?: string;
  target?: string | null;
  status?: number | null;
  denied?: boolean;
  ip?: string | null;
  ua?: string | null;
  branchId?: number | null;
  body?: unknown;
  details?: Record<string, unknown>;
  /** Tahrir/o'chirishdan OLDINGI holat (proxy; 25.10.2026 dan). */
  before?: Record<string, unknown>;
}

/** Matn bo'lagi: `k` — tarjima kaliti (`p` — o'rinbosar, `pk` — o'rinbosar ham kalit: o'girilib kichik harfga), `v` — ma'lumot. */
export type LogText = { k: string; p?: Record<string, string | number>; pk?: Record<string, string> } | { v: string };

export interface LogDiffRow {
  /** Maydon kaliti (`LOG_FIELD_LABELS` da bo'lsa — o'zbekcha nom, aks holda kalitning o'zi). */
  field: string;
  label: string | null;
  before: string | null;
  after: string;
}

export interface LogView {
  id: string;
  at: string;
  /** Toshkent kuni va vaqti. */
  day: string;
  time: string;
  cat: LogCategory;
  icon: LogIcon;
  actor: LogText;
  /** Fe'l — o'zbekcha kalit (`LOG_VERBS` qiymati). */
  verb: string;
  object: string | null;
  meta: LogText[];
  /** So'm; `amountTone` — rangi (kirim yashil, chiqim qizil, o'tkazma — betaraf). */
  amount: number | null;
  amountTone: "in" | "out" | "neutral" | null;
  badge: "deleted" | "denied" | null;
  /** Tahrirda o'zgargan maydonlar; `beforeKnown` — eski qiymat bormi (25.10 dan oldingi yozuvda yo'q). */
  diff: LogDiffRow[];
  beforeKnown: boolean;
  /** Qidiruv uchun (kichik harf). */
  search: string;
}

/** Bo'lim → nomini olish mumkin bo'lgan to'plam (proxy «oldin» nusxasi va nomlar uchun). */
export const LOG_OBJECTS: Record<string, { col: string; fields: readonly string[] }> = {
  pupils: { col: "pupils", fields: ["firstName", "lastName"] },
  groups: { col: "groups", fields: ["name", "course", "level"] },
  orders: { col: "orders", fields: ["name"] },
  "hr-employees": { col: "hr_employees", fields: ["name"] },
  employees: { col: "employees", fields: ["name"] },
  cashboxes: { col: "cashboxes", fields: ["name"] },
  rooms: { col: "rooms", fields: ["name"] },
  "offline-courses": { col: "offline_courses", fields: ["name"] },
  roles: { col: "roles", fields: ["name"] },
  branches: { col: "branches", fields: ["name"] },
  "management-cv": { col: "cv_applications", fields: ["name"] },
  "salary-runs": { col: "salary_runs", fields: ["month"] },
  "staff-tasks": { col: "staff_tasks", fields: ["title"] },
  "transaction-entries": { col: "transaction_entries", fields: ["studentName", "amount", "txName", "paymentMethodKey", "cashboxId"] },
};

/** To'plamdagi hujjatdan ko'rinadigan nom («Ingliz tili · 2-bosqich», «Muxlisa Xoshimjanova»). */
export function objectNameOf(col: string, doc: Record<string, unknown> | null | undefined): string {
  if (!doc) return "";
  const s = (k: string) => (typeof doc[k] === "string" ? (doc[k] as string).trim() : typeof doc[k] === "number" ? String(doc[k]) : "");
  if (col === "pupils") return `${s("firstName")} ${s("lastName")}`.trim();
  if (col === "groups") return [s("course"), s("level")].filter(Boolean).join(" · ") || s("name");
  if (col === "salary_runs") return s("month");
  if (col === "staff_tasks") return s("title");
  if (col === "transaction_entries") return s("studentName") || s("txName");
  return s("name");
}

/** Nomlar: to'plam → id → nom; to'lov turi kaliti → nom; filial id → nom. */
export interface LogNames {
  byCol: Record<string, Record<string, string>>;
  methods: Record<string, string>;
  branches: Record<string, string>;
}

export const EMPTY_LOG_NAMES: LogNames = { byCol: {}, methods: {}, branches: {} };

/* ── Toifa ─────────────────────────────────────────────────────────────── */

const FIN_SECTIONS = new Set(["cashboxes", "transaction-entries", "salary-runs", "bonuses", "penalties", "planned-expenses", "finance-contracts", "contracts", "teacher-handovers"]);
const PUPIL_SECTIONS = new Set(["pupils", "students", "groups", "group-tasks", "gamification", "imtihon", "block-test-exams", "block-test-types", "student-sources", "seasonal-assessments"]);
const LEAD_SECTIONS = new Set(["orders", "lead-settings"]);
const ATT_SECTIONS = new Set(["attendance", "attendance-qr"]);
const STAFF_SECTIONS = new Set(["hr-employees", "employees", "roles", "work-schedules", "staff-tasks", "tasks", "temp-staff", "management-cv"]);
const FIN_ACTIONS = new Set(["kirim", "chiqim", "transfer", "method_transfer", "transfer_confirm", "transfer_reject", "settle_teacher_share", "settle_teacher_share_undo"]);
const STAFF_ACTIONS = new Set(["qr_in", "qr_out", "face_enroll", "task_failed_fine", "staff_task_done", "staff_task_approve", "staff_task_return"]);
const LEAD_ACTIONS = new Set(["lead", "lead_holat"]);

export function logCategory(r: Pick<LogRow, "section" | "action" | "path">): LogCategory {
  if (r.action === "login" || r.action === "login_failed" || r.section === "auth" || r.section === "sessions") return "auth";
  if (r.action === "DELETE") return "deleted";
  if (FIN_ACTIONS.has(r.action)) return "finance";
  if (STAFF_ACTIONS.has(r.action)) return "staff";
  if (LEAD_ACTIONS.has(r.action)) return "leads";
  if (/^\/api\/groups\/\d+\/(attendance|lessons)/.test(r.path ?? "") || ATT_SECTIONS.has(r.section)) return "attendance";
  if (FIN_SECTIONS.has(r.section)) return "finance";
  if (PUPIL_SECTIONS.has(r.section)) return "pupils";
  if (LEAD_SECTIONS.has(r.section)) return "leads";
  if (STAFF_SECTIONS.has(r.section)) return "staff";
  return "other";
}

export function categoryLabel(cat: LogCategory): string {
  return LOG_CATEGORIES.find((c) => c.key === cat)?.label ?? cat;
}

/* ── Fe'l ──────────────────────────────────────────────────────────────── */

interface Rule {
  m: string;
  re: RegExp;
  verb: LogVerbKey;
  icon: LogIcon;
}

const RULES: Rule[] = [
  { m: "POST", re: /^\/api\/auth\/logout$/, verb: "logout", icon: "logout" },
  { m: "POST", re: /^\/api\/auth\/lock$/, verb: "lock", icon: "login" },
  { m: "POST", re: /^\/api\/auth\/unlock$/, verb: "unlock", icon: "login" },
  { m: "POST", re: /^\/api\/auth\/change-password$/, verb: "change_password", icon: "login" },
  { m: "POST", re: /^\/api\/auth\/activate$/, verb: "activate", icon: "login" },
  { m: "POST", re: /^\/api\/auth\/forgot-password$/, verb: "forgot_password", icon: "login" },
  { m: "POST", re: /^\/api\/auth\/reset-password$/, verb: "reset_password", icon: "login" },
  { m: "DELETE", re: /^\/api\/sessions/, verb: "session_drop", icon: "logout" },
  { m: "POST", re: /^\/api\/cashboxes\/\d+\/transfer$/, verb: "method_transfer", icon: "move" },
  { m: "POST", re: /^\/api\/cashboxes\/\d+\/transfer-to$/, verb: "transfer_to", icon: "move" },
  { m: "POST", re: /^\/api\/cashboxes\/handover$/, verb: "handover", icon: "move" },
  { m: "POST", re: /^\/api\/transaction-entries\/\d+\/cancel$/, verb: "payment_cancel", icon: "out" },
  { m: "POST", re: /^\/api\/transaction-entries\/\d+\/transfer-confirm$/, verb: "transfer_confirm", icon: "move" },
  { m: "POST", re: /^\/api\/transaction-entries\/\d+\/transfer-reject$/, verb: "transfer_reject", icon: "move" },
  { m: "POST", re: /^\/api\/salary-runs$/, verb: "salary_run", icon: "out" },
  { m: "DELETE", re: /^\/api\/salary-runs\/\d+$/, verb: "salary_run_cancel", icon: "delete" },
  { m: "POST", re: /^\/api\/pupils$/, verb: "pupil_add", icon: "pupil" },
  { m: "PATCH PUT POST", re: /^\/api\/pupils\/\d+\/status$/, verb: "pupil_status", icon: "pupil" },
  { m: "PATCH PUT", re: /^\/api\/pupils\/\d+(\/profile)?$/, verb: "pupil_edit", icon: "pupil" },
  { m: "DELETE", re: /^\/api\/pupils\/\d+$/, verb: "pupil_delete", icon: "delete" },
  { m: "POST", re: /^\/api\/groups$/, verb: "group_add", icon: "group" },
  { m: "PATCH PUT", re: /^\/api\/groups\/\d+$/, verb: "group_edit", icon: "group" },
  { m: "DELETE", re: /^\/api\/groups\/\d+$/, verb: "group_delete", icon: "delete" },
  { m: "POST", re: /^\/api\/groups\/\d+\/students$/, verb: "group_pupils", icon: "group" },
  { m: "DELETE", re: /^\/api\/groups\/\d+\/students$/, verb: "group_pupil_remove", icon: "delete" },
  { m: "POST", re: /^\/api\/groups\/\d+\/attendance$/, verb: "attendance", icon: "attendance" },
  { m: "POST", re: /^\/api\/groups\/\d+\/lessons$/, verb: "lesson_add", icon: "attendance" },
  { m: "DELETE", re: /^\/api\/groups\/\d+\/lessons$/, verb: "lesson_delete", icon: "delete" },
  { m: "POST", re: /^\/api\/orders$/, verb: "lead_add", icon: "lead" },
  { m: "PATCH PUT", re: /^\/api\/orders\/\d+$/, verb: "lead_edit", icon: "lead" },
  { m: "POST", re: /^\/api\/orders\/\d+\/holat$/, verb: "lead_holat", icon: "lead" },
  { m: "POST", re: /^\/api\/orders\/\d+\/comments$/, verb: "lead_comment", icon: "lead" },
  { m: "POST", re: /^\/api\/hr-employees$/, verb: "employee_add", icon: "staff" },
  { m: "PATCH PUT", re: /^\/api\/hr-employees\/\d+$/, verb: "employee_edit", icon: "staff" },
  { m: "DELETE", re: /^\/api\/hr-employees\/\d+$/, verb: "employee_delete", icon: "delete" },
  { m: "POST", re: /^\/api\/hr-employees\/\d+\/password$/, verb: "employee_password", icon: "staff" },
  { m: "DELETE", re: /^\/api\/hr-employees\/\d+\/face$/, verb: "face_reset", icon: "delete" },
  { m: "PATCH", re: /^\/api\/hr-employees\/\d+\/face$/, verb: "face_exempt", icon: "staff" },
];

/** Bot, kirish va tizim amallari (HTTP usuli emas). */
const SPECIAL: Record<string, { verb: LogVerbKey; icon: LogIcon }> = {
  login: { verb: "login", icon: "login" },
  login_failed: { verb: "login_failed", icon: "denied" },
  kirim: { verb: "kirim", icon: "in" },
  chiqim: { verb: "chiqim", icon: "out" },
  transfer: { verb: "transfer_to", icon: "move" },
  method_transfer: { verb: "method_transfer", icon: "move" },
  transfer_confirm: { verb: "transfer_confirm", icon: "move" },
  transfer_reject: { verb: "transfer_reject", icon: "move" },
  lead: { verb: "lead_add", icon: "lead" },
  lead_holat: { verb: "lead_holat", icon: "lead" },
  qr_in: { verb: "qr_in", icon: "staff" },
  qr_out: { verb: "qr_out", icon: "staff" },
  face_enroll: { verb: "face_enroll", icon: "staff" },
  task_failed_fine: { verb: "task_fine", icon: "staff" },
  staff_task_done: { verb: "task_done", icon: "staff" },
  staff_task_approve: { verb: "task_approve", icon: "staff" },
  staff_task_return: { verb: "task_return", icon: "staff" },
  settle_teacher_share: { verb: "teacher_share", icon: "move" },
  settle_teacher_share_undo: { verb: "teacher_share_undo", icon: "move" },
};

function ruleFor(r: LogRow): { verb: LogVerbKey; icon: LogIcon } {
  const sp = SPECIAL[r.action];
  if (sp) return sp;
  const path = r.path ?? "";
  if (r.action === "POST" && /^\/api\/cashboxes\/\d+\/adjust$/.test(path)) {
    return obj(r.body).mode === "chiqim" ? { verb: "chiqim", icon: "out" } : { verb: "kirim", icon: "in" };
  }
  const hit = RULES.find((x) => x.m.split(" ").includes(r.action) && x.re.test(path));
  if (hit) return { verb: hit.verb, icon: hit.icon };
  if (r.action === "DELETE") return { verb: "remove", icon: "delete" };
  if (r.action === "POST") return { verb: "add", icon: "other" };
  return { verb: "edit", icon: "other" };
}

/* ── Yordamchilar ──────────────────────────────────────────────────────── */

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/\s/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Toshkent (UTC+5) kuni va soati. */
export function tashkentParts(iso: string): { day: string; time: string } {
  const d = new Date(new Date(iso).getTime() + 5 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return { day: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` };
}

/** Qurilma turi: «kompyuter» / «telefon» / «planshet» (kalit — o'giriladi). */
export function deviceOf(ua: string | null | undefined): string | null {
  if (!ua) return null;
  if (/iPad|Tablet/i.test(ua)) return "planshet";
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) return "telefon";
  return "kompyuter";
}

/** Tahrir jadvali uchun qiymat (qisqa matn). */
export function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim().length > 80 ? `${v.trim().slice(0, 78)}…` : v.trim();
  if (typeof v === "number") return Number.isFinite(v) ? (Math.abs(v) >= 10_000 ? Math.round(v).toLocaleString("ru-RU").replace(/\s|,/g, " ") : String(v)) : "";
  if (typeof v === "boolean") return v ? "ha" : "yo'q";
  if (Array.isArray(v)) {
    if (!v.length) return "";
    if (v.every((x) => typeof x === "string" || typeof x === "number")) {
      const head = v.slice(0, 6).map((x) => String(x)).join(", ");
      return v.length > 6 ? `${head} … (+${v.length - 6})` : head;
    }
    return `${v.length} ta`;
  }
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? `${s.slice(0, 78)}…` : s;
  } catch {
    return "";
  }
}

/** Tahrirda ko'rsatilmaydigan maydonlar (xizmat, ro'yxatlar, tarixlar). */
const DIFF_SKIP = new Set(["id", "_id", "createdAt", "updatedAt", "created", "branchId", "branchNo", "studentIds", "history", "holatHistory", "comments", "editHistory", "messages", "isNew", "ord"]);

/** Tahrir: yuborilgan qiymat ↔ eski holat (bo'lsa). O'zgarmagan maydon tashlanadi. */
export function diffOf(body: unknown, before: Record<string, unknown> | undefined): { rows: LogDiffRow[]; beforeKnown: boolean } {
  const b = obj(body);
  const beforeKnown = !!before && Object.keys(before).length > 0;
  const rows: LogDiffRow[] = [];
  for (const [k, v] of Object.entries(b)) {
    if (DIFF_SKIP.has(k) || k.startsWith("$") || v === "***") continue;
    const after = fmtValue(v);
    const was = beforeKnown ? fmtValue(before![k]) : null;
    if (beforeKnown && was === after) continue;
    if (!beforeKnown && after === "") continue;
    rows.push({ field: k, label: LOG_FIELD_LABELS[k] ?? null, before: was, after });
    if (rows.length >= 15) break;
  }
  return { rows, beforeKnown };
}

/* ── Qator ─────────────────────────────────────────────────────────────── */

function nameFor(names: LogNames, col: string, id: unknown): string {
  const key = str(id);
  return key ? names.byCol[col]?.[key] ?? "" : "";
}

export function buildLogView(r: LogRow, names: LogNames = EMPTY_LOG_NAMES): LogView {
  const { day, time } = tashkentParts(r.at);
  const cat = logCategory(r);
  const { verb, icon } = ruleFor(r);
  const body = obj(r.body);
  const det = obj(r.details);
  const before = r.before && typeof r.before === "object" ? r.before : undefined;
  const meta: LogText[] = [];
  let object: string | null = null;
  let amount: number | null = null;
  let amountTone: LogView["amountTone"] = null;
  let diff: LogDiffRow[] = [];
  let beforeKnown = false;

  // Kim: ism → telefon → «Tizimga kirmagan» / «Tizim».
  const actorName = str(r.actor?.name) || str(r.actor?.phone);
  const actor: LogText = actorName
    ? { v: actorName }
    : r.actor?.kind === "system" || r.source === "cron"
      ? { k: "Tizim" }
      : { k: "Tizimga kirmagan" };

  // Obyekt: bo'limning to'plamidan nom (bo'lsa), o'chirilganda — eski holatdan.
  const objCfg = LOG_OBJECTS[r.section];
  const targetName = () => (objCfg ? nameFor(names, objCfg.col, r.target) || (before ? objectNameOf(objCfg.col, before) : "") : "");
  const cashboxName = (id: unknown) => nameFor(names, "cashboxes", id);
  const methodName = (key: unknown) => {
    const k = str(key);
    return k ? names.methods[k] ?? k : "";
  };

  // Birinchi bo'lak — toifa («Moliya», «Kirishlar» …); «Boshqa»da — bo'limning o'zi.
  meta.push({ k: cat === "other" ? sectionLabel(r.section) : categoryLabel(cat) });
  if (cat === "deleted") meta.push({ k: sectionLabel(r.section) });

  switch (verb) {
    case "login":
    case "login_failed":
    case "logout":
    case "lock":
    case "unlock":
    case "change_password":
    case "activate":
    case "forgot_password":
    case "reset_password":
    case "session_drop": {
      const dev = r.source === "bot" ? "Telegram bot" : r.source === "miniapp" ? "Telegram ilova" : deviceOf(r.ua);
      if (dev) meta.push({ k: dev });
      if (verb === "login_failed" && str(det.reason)) meta.push({ k: "sabab: {reason}", p: { reason: str(det.reason) } });
      break;
    }
    case "kirim":
    case "chiqim": {
      const web = r.action === "POST";
      const sum = num(web ? body.amount : det.amount);
      if (sum !== null) {
        amount = verb === "kirim" ? Math.abs(sum) : -Math.abs(sum);
        amountTone = verb === "kirim" ? "in" : "out";
      }
      // Obyekt — odam (o'quvchi / ustoz / xodim), bo'lmasa kirim-chiqim turi; odam bo'lsa turi meta'da.
      const person = web ? str(body.studentName) || str(body.teacherName) : verb === "kirim" ? str(det.student) : str(det.person);
      const category = web ? str(body.category) : str(det.category);
      object = person || category;
      const m = methodName(web ? body.method : det.method);
      if (m) meta.push({ v: m });
      const kassa = web ? cashboxName(r.target) : str(det.cashbox) || cashboxName(det.cashboxId);
      if (kassa) meta.push({ k: "kassa: {name}", p: { name: kassa } });
      // Odamga chiqimda turi ham (avans, qaytarish …); kirimda odatda «O'quvchi to'ladi» — ortiqcha.
      if (person && category && verb === "chiqim") meta.push({ v: category });
      if (!web) meta.push({ k: "Telegram bot" });
      break;
    }
    case "method_transfer": {
      const web = r.action === "POST";
      const sum = num(web ? body.amount : det.amount);
      if (sum !== null) {
        amount = Math.abs(sum);
        amountTone = "neutral";
      }
      object = web ? cashboxName(r.target) : str(det.cashbox);
      const from = methodName(web ? body.from : det.from);
      const to = methodName(web ? body.to : det.to);
      if (from || to) meta.push({ v: `${from || "?"} → ${to || "?"}` });
      if (!web) meta.push({ k: "Telegram bot" });
      break;
    }
    case "transfer_to": {
      const web = r.action === "POST";
      const sum = num(web ? body.amount : det.amount);
      if (sum !== null) {
        amount = Math.abs(sum);
        amountTone = "neutral";
      }
      const fromKassa = web ? cashboxName(r.target) : str(det.cashbox);
      object = cashboxName(web ? body.toCashboxId : det.toCashboxId) || null;
      if (fromKassa) meta.push({ k: "kassa: {name}", p: { name: fromKassa } });
      const m = methodName(web ? body.method : det.method);
      if (m) meta.push({ v: m });
      if (!web) meta.push({ k: "Telegram bot" });
      break;
    }
    case "payment_cancel": {
      object = before ? objectNameOf("transaction_entries", before) || null : null;
      const sum = num(before?.amount);
      if (sum !== null) meta.push({ k: "{sum} so'm", p: { sum: fmtValue(Math.abs(sum)) } });
      const kassa = cashboxName(before?.cashboxId);
      if (kassa) meta.push({ k: "kassa: {name}", p: { name: kassa } });
      break;
    }
    case "salary_run":
      object = str(body.month) || null;
      break;
    case "teacher_share":
    case "teacher_share_undo": {
      const n = Array.isArray(det.entries) ? det.entries.length : num(det.undone);
      if (n) meta.push({ k: "{n} ta yozuv", p: { n } });
      break;
    }
    case "pupil_add":
      object = `${str(body.firstName)} ${str(body.lastName)}`.trim() || null;
      break;
    case "group_add":
      object = [str(body.course), str(body.level)].filter(Boolean).join(" · ") || str(body.name) || null;
      break;
    case "lead_add":
      object = str(body.name) || str(det.name) || str(det.student) || null;
      break;
    case "employee_add":
      object = str(body.name) || null;
      break;
    case "lead_holat": {
      object = targetName() || str(det.name) || null;
      const to = str(body.to) || str(det.to) || str(det.holat);
      const nom = HOLATLAR.find((h) => h.id === to)?.nom;
      if (to) meta.push(nom ? { k: "→ {to}", pk: { to: nom } } : { k: "→ {to}", p: { to } });
      break;
    }
    case "qr_in":
    case "qr_out":
    case "face_enroll":
      object = null;
      break;
    case "task_done":
    case "task_approve":
    case "task_return":
    case "task_fine":
      object = str(det.title) || null;
      if (!r.path) meta.push({ k: "Telegram bot" });
      break;
    case "group_pupils": {
      object = targetName() || null;
      const ids = Array.isArray(body.pupilIds) ? body.pupilIds.length : body.pupilId !== undefined ? 1 : 0;
      if (ids) meta.push({ k: "{n} ta o'quvchi", p: { n: ids } });
      break;
    }
    default:
      object = targetName() || (r.target ? `#${r.target}` : null);
  }

  // Rad etilgan / xato so'rov — o'zgarish bo'lmagan: «oldin → keyin» yo'q, belgi bilan.
  const failed = r.denied || (typeof r.status === "number" && r.status >= 400);

  // Tahrir — «oldin → keyin» (PUT/PATCH tanasi bo'yicha).
  if (!failed && (r.action === "PATCH" || r.action === "PUT") && Object.keys(body).length) {
    const d = diffOf(body, before);
    diff = d.rows;
    beforeKnown = d.beforeKnown;
    if (r.branchId) {
      const b = names.branches[String(r.branchId)];
      if (b) meta.push({ v: b });
    }
    if (beforeKnown && diff.length === 1) {
      const one = diff[0];
      const label = one.label ?? one.field;
      meta.push(
        !one.before
          ? { k: "{field} qo'shildi", pk: { field: label } }
          : !one.after
            ? { k: "{field} o'chirildi", pk: { field: label } }
            : { k: "{field} o'zgardi", pk: { field: label } },
      );
    } else if (diff.length) meta.push({ k: "{n} ta maydon", p: { n: diff.length } });
    else if (beforeKnown) meta.push({ k: "o'zgarish yo'q" });
  } else if (cat === "auth" || verb === "kirim" || verb === "chiqim") {
    // Kirish va pul — qaysi filialda (navbar) ekani ham.
    if (r.branchId && cat === "auth") {
      const b = names.branches[String(r.branchId)];
      if (b) meta.push({ v: b });
    }
  } else if (r.branchId && cat !== "deleted") {
    const b = names.branches[String(r.branchId)];
    if (b) meta.push({ v: b });
  }

  // O'chirish sababi (tanada yoki so'rovda bo'lsa).
  if (r.action === "DELETE") {
    const q = new URLSearchParams((r.query ?? "").replace(/^\?/, ""));
    const reason = str(body.reason) || str(body.comment) || str(q.get("reason"));
    if (reason) meta.push({ k: "sabab: {reason}", p: { reason } });
  }

  const badge: LogView["badge"] = failed ? "denied" : r.action === "DELETE" ? "deleted" : null;

  const search = [
    actorName,
    object ?? "",
    LOG_VERBS[verb],
    ...meta.map((m) => ("v" in m ? m.v : [m.k, ...Object.values(m.p ?? {}), ...Object.values(m.pk ?? {})].join(" "))),
    amount !== null ? String(Math.abs(amount)) : "",
    sectionLabel(r.section),
  ]
    .join(" ")
    .toLowerCase();

  return {
    id: r.id,
    at: r.at,
    day,
    time,
    cat,
    icon: failed && icon !== "delete" ? "denied" : icon,
    actor,
    verb: LOG_VERBS[verb],
    object: object || null,
    meta,
    amount,
    amountTone,
    badge,
    diff,
    beforeKnown,
    search,
  };
}
