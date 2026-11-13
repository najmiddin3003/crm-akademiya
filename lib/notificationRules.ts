import type { Db } from "mongodb";

// SOZLAMALAR → «BILDIRISHNOMALAR» (23-qism, 13.11.2026; rasm «Sozlamalar · Bildirishnomalar»).
// Qaysi hodisa kimga boradi — rollar bo'yicha jadval + «Muhim» belgisi. Saqlanadi
// `notification_rules` ({ key: "main" }) da, FAQAT admin o'zgartiradi
// (app/api/notification-rules).
//
// HALOL HOLAT (13.11.2026): qo'ng'iroq bu jadvalni HALI O'QIMAYDI. U hozir to'lov, lid va
// topshiriq manbalarini BO'LIM RUXSATI bo'yicha ko'rsatadi (app/api/notifications), e'lonlar —
// hammaga. Jadvaldagi hodisalarning ko'pi tizimda boshqa joyda yashaydi yoki umuman yo'q —
// har hodisaning `now` maydoni shuni yozadi. Ulash rejasi — design/v2/SAVOLLAR.md.
//
// Bu fayl mongodb'ni faqat TIP sifatida oladi — sahifa (mijoz) ham import qiladi.

export const NOTIFICATION_RULES = "notification_rules";
const KEY = "main";

// ── Rollar (jadval ustunlari) ──────────────────────────────────────────────
//
// Rasmdagi besh ustun. Tizimdagi haqiqiy rollarga moslik (`columnOfRole`):
//   rahbar    — users.role "admin" (direktor) + Rollar'dagi nomida «rahbar» / «direktor» /
//               «bosh admin» bor qo'lda qo'shilgan rol (Akademiya: «Rahbar / Bosh admin»);
//   menejer   — nomida «menejer» / «manager» (Akademiya: «Filial menejeri»);
//   qabul     — nomida «qabul» / «reception» (Akademiya: «Qabul administratori»);
//   teacher   — o'rnatilgan rol, hr_employees.turi "teacher";
//   moderator — o'rnatilgan rol, hr_employees.turi "moderator".
// Mos kelmagan qo'lda qo'shilgan rollar (Akademiya: «IT mutaxassisi», «Xizmat xodimi») ustun
// olmaydi — ular faqat «Doim» qatorlarini (o'ziga tegishlisini) oladi. Har markazda rollar
// boshqacha (Temuriylar) — sahifa ustun ostida qaysi rollar tushganini ko'rsatadi.

export const NOTIFY_COLUMNS = ["rahbar", "menejer", "qabul", "teacher", "moderator"] as const;
export type NotifyColumn = (typeof NOTIFY_COLUMNS)[number];

export const NOTIFY_COLUMN_LABEL: Record<NotifyColumn, string> = {
  rahbar: "Rahbar",
  menejer: "Menejer",
  qabul: "Qabul admin.",
  teacher: "O'qituvchi",
  moderator: "Moderator",
};

function normName(s: string): string {
  return s.toLowerCase().replace(/[‘’ʻʼ`']/g, "").replace(/\s+/g, " ").trim();
}

/** Rollar'dagi rol → jadval ustuni (mos kelmasa — null). Sof funksiya. */
export function columnOfRole(role: { key?: string | null; name?: string | null }): NotifyColumn | null {
  if (role.key === "teacher") return "teacher";
  if (role.key === "moderator") return "moderator";
  const n = normName(String(role.name ?? ""));
  if (!n) return null;
  if (/rahbar|direktor|bosh admin/.test(n)) return "rahbar";
  if (/menejer|menedjer|manager/.test(n)) return "menejer";
  if (/qabul|reception|resepshn/.test(n)) return "qabul";
  return null;
}

// ── Hodisalar ──────────────────────────────────────────────────────────────

export type NotifyEventKey =
  | "attendanceMissed"
  | "staffAbsent"
  | "staffLate"
  | "studentAbsentStreak"
  | "leadNotCalled"
  | "leadNew"
  | "firstLessonResult"
  | "referralGift"
  | "paymentOverdue"
  | "tasks"
  | "bonusPenalty"
  | "announcements";

/** Hodisa bugun tizimda qayerga boradi (sahifadagi halol izoh va kelajakdagi ulash uchun). */
export type NotifyNow = "bell" | "telegram" | "ai" | "none";

/** Izohdagi `{n}` qaysi vaqtdan olinadi (GET javobidagi `timing`). */
export type NotifyHintParam = "missedAfterMin" | "absentAfterMin";

export interface NotifyEvent {
  key: NotifyEventKey;
  label: string;
  /** Kichik izoh — qachon ishga tushadi. `{n}` — `hintParam` qiymati. */
  hint: string;
  hintParam?: NotifyHintParam;
  /** Izohda «· Nazorat qoidasi» havolasi (/settings-nazorat) — qoida u yerda yoqiladi. */
  nazorat?: boolean;
  /** Qulf: rollar tanlanmaydi, «Doim: …» (topshiriq, bonus/jarima, e'lonlar). */
  locked?: string;
  defaults: { roles: NotifyColumn[]; important: boolean };
  now: NotifyNow;
  /** `now` ning qisqa izohi (jadval qatoridagi sichqoncha izohi). */
  nowNote: string;
}

export const NOTIFY_GROUPS: { title: string; events: NotifyEvent[] }[] = [
  {
    title: "Nazorat",
    events: [
      {
        key: "attendanceMissed",
        label: "Davomat va jurnal yozilmagan",
        hint: "dars tugaganidan {n} daqiqa keyin",
        hintParam: "missedAfterMin",
        nazorat: true,
        defaults: { roles: ["rahbar", "menejer", "teacher"], important: true },
        now: "telegram",
        nowNote: "Hozir: filialning Telegram «davomat» topigiga",
      },
      {
        key: "staffAbsent",
        label: "Xodim ishga kelmadi",
        hint: "o'qituvchi: dars boshlanib {n} daqiqa o'tsa",
        hintParam: "absentAfterMin",
        nazorat: true,
        defaults: { roles: ["rahbar", "menejer"], important: true },
        now: "telegram",
        nowNote: "Hozir: xodimlar botida Nazorat qoidalaridagi ro'yxatga",
      },
      {
        key: "staffLate",
        label: "Xodim kechikdi",
        hint: "«Ishga keldim» ish vaqtidan kech bosilsa",
        defaults: { roles: ["rahbar", "menejer"], important: false },
        now: "telegram",
        nowNote: "Hozir: filialning Telegram «davomat» topigiga",
      },
      {
        key: "studentAbsentStreak",
        label: "O'quvchi ketma-ket 2 dars qoldirdi",
        hint: "davomat belgilanganda",
        defaults: { roles: ["rahbar", "qabul", "teacher"], important: false },
        now: "none",
        nowNote: "Hozir tizimda yo'q",
      },
    ],
  },
  {
    title: "Lidlar",
    events: [
      {
        key: "leadNotCalled",
        label: "Lidga qo'ng'iroq qilinmagan",
        hint: "lid kelganidan 24 soat o'tsa",
        defaults: { roles: ["rahbar", "qabul", "moderator"], important: true },
        now: "ai",
        nowNote: "Hozir: adminga MohirAI ogohlantirishida",
      },
      {
        key: "leadNew",
        label: "Yangi ariza (bot, sayt)",
        hint: "darhol",
        defaults: { roles: ["rahbar", "qabul", "moderator"], important: false },
        now: "bell",
        nowNote: "Hozir: qo'ng'iroqda — Lidlar bo'limiga ruxsati borlarga",
      },
      {
        key: "firstLessonResult",
        label: "Birinchi dars natijasi yozilmagan",
        hint: "dars kunining ertasiga 09:00 da",
        defaults: { roles: ["qabul", "teacher"], important: false },
        now: "none",
        nowNote: "Hozir: faqat yon menyudagi son (Birinchi darsga yozilganlar)",
      },
      {
        key: "referralGift",
        label: "Referal: sovg'a so'rovi",
        hint: "darhol",
        defaults: { roles: ["rahbar", "menejer"], important: false },
        now: "none",
        nowNote: "Hozir tizimda yo'q — referal dasturi hali yo'q",
      },
    ],
  },
  {
    title: "Moliya",
    events: [
      {
        key: "paymentOverdue",
        label: "To'lov muddati o'tdi",
        hint: "har kuni 09:00 da",
        defaults: { roles: ["rahbar", "qabul"], important: false },
        now: "none",
        nowNote: "Hozir tizimda yo'q — qarzdorlar hisobotda",
      },
    ],
  },
  {
    title: "Topshiriq va oylik",
    events: [
      {
        key: "tasks",
        label: "Topshiriq: yangi, muddati o'tdi, bajarildi",
        hint: "darhol",
        locked: "Bergan va bajaruvchi",
        defaults: { roles: [], important: false },
        now: "bell",
        nowNote: "Hozir: qo'ng'iroqda",
      },
      {
        key: "bonusPenalty",
        label: "Bonus yoki jarima yozildi",
        hint: "darhol",
        locked: "Xodimning o'zi",
        defaults: { roles: [], important: false },
        now: "bell",
        nowNote: "Hozir: qo'ng'iroqda faqat topshiriq jarimasi",
      },
    ],
  },
  {
    title: "Tizim",
    events: [
      {
        key: "announcements",
        label: "Tizimli yangiliklari, texnik ishlar",
        hint: "E'lonlar bo'limida",
        locked: "Hammaga",
        defaults: { roles: [], important: false },
        now: "bell",
        nowNote: "Hozir: qo'ng'iroq → E'lonlar",
      },
    ],
  },
];

export const NOTIFY_EVENTS: NotifyEvent[] = NOTIFY_GROUPS.flatMap((g) => g.events);
const EVENT_BY_KEY = new Map(NOTIFY_EVENTS.map((e) => [e.key, e]));
/** Tanlanadigan (qulfsiz) hodisalar — saqlanadiganlari faqat shular. */
export const EDITABLE_EVENTS = NOTIFY_EVENTS.filter((e) => !e.locked);

export interface NotifyRule {
  roles: NotifyColumn[];
  important: boolean;
}
export type NotifyRules = Record<string, NotifyRule>;

/** Rasmdagi sukut belgilari. */
export function defaultNotifyRules(): NotifyRules {
  return Object.fromEntries(EDITABLE_EVENTS.map((e) => [e.key, { roles: [...e.defaults.roles], important: e.defaults.important }]));
}

/**
 * Bazadan yoki mijozdan kelgan qiymatni tozalaydi: notanish hodisa/rol tashlanadi, qulfli
 * hodisalar saqlanmaydi, yo'q hodisa — sukutdan. Rollar NOTIFY_COLUMNS tartibida.
 */
export function normalizeNotifyRules(raw: unknown): NotifyRules {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = defaultNotifyRules();
  for (const e of EDITABLE_EVENTS) {
    const r = src[e.key];
    if (!r || typeof r !== "object" || Array.isArray(r)) continue;
    const rr = r as { roles?: unknown; important?: unknown };
    const roles = Array.isArray(rr.roles) ? new Set(rr.roles.map(String)) : null;
    out[e.key] = {
      roles: roles ? NOTIFY_COLUMNS.filter((c) => roles.has(c)) : out[e.key].roles,
      important: typeof rr.important === "boolean" ? rr.important : out[e.key].important,
    };
  }
  return out;
}

/** Mijozdan kelgan qiymat tekshiruvi (PUT): faqat obyekt, notanish kalitlar jimgina tashlanadi. */
export function parseNotifyRules(raw: unknown): { ok: true; rules: NotifyRules } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Noto'g'ri so'rov" };
  for (const v of Object.values(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "Noto'g'ri so'rov" };
    const r = v as { roles?: unknown; important?: unknown };
    if (r.roles !== undefined && !Array.isArray(r.roles)) return { ok: false, error: "Noto'g'ri so'rov" };
    if (r.important !== undefined && typeof r.important !== "boolean") return { ok: false, error: "Noto'g'ri so'rov" };
  }
  return { ok: true, rules: normalizeNotifyRules(raw) };
}

export function notifyEvent(key: string): NotifyEvent | undefined {
  return EVENT_BY_KEY.get(key as NotifyEventKey);
}

// ── Saqlash ────────────────────────────────────────────────────────────────

export interface StoredNotifyRules {
  rules: NotifyRules;
  /** Hali saqlanmagan — sukut ko'rsatilmoqda. */
  saved: boolean;
  updatedAt: string | null;
}

export async function loadNotifyRules(db: Db): Promise<StoredNotifyRules> {
  const doc = await db.collection(NOTIFICATION_RULES).findOne({ key: KEY });
  return {
    rules: normalizeNotifyRules(doc?.rules),
    saved: !!doc,
    updatedAt: doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
  };
}

/** `by` — saqlagan foydalanuvchining `users._id` si (telefon/ism emas). */
export async function saveNotifyRules(db: Db, rules: NotifyRules, by: string): Promise<StoredNotifyRules> {
  const clean = normalizeNotifyRules(rules);
  const now = new Date();
  await db
    .collection(NOTIFICATION_RULES)
    .updateOne({ key: KEY }, { $set: { rules: clean, updatedAt: now, updatedBy: by } }, { upsert: true });
  return { rules: clean, saved: true, updatedAt: now.toISOString() };
}

// ── Ustunlar ostidagi haqiqiy rollar ───────────────────────────────────────

export interface NotifyColumnInfo {
  key: NotifyColumn;
  /** Shu ustunga tushadigan rollar nomi (Rollar'dagidek; rahbarda «Administrator» ham). */
  roles: string[];
}

/** Rollar kolleksiyasidan ustunlar va ustun olmagan rollar (sahifa izohlari uchun). */
export async function notifyColumnsInfo(db: Db): Promise<{ columns: NotifyColumnInfo[]; others: string[] }> {
  const rows = await db
    .collection("roles")
    .find({}, { projection: { _id: 0, id: 1, key: 1, name: 1 } })
    .sort({ id: 1 })
    .toArray();
  const by: Record<NotifyColumn, string[]> = { rahbar: ["Administrator"], menejer: [], qabul: [], teacher: [], moderator: [] };
  const others: string[] = [];
  for (const r of rows) {
    const name = String(r.name ?? "").trim();
    const col = columnOfRole({ key: typeof r.key === "string" ? r.key : null, name });
    if (col) {
      if (name && !by[col].includes(name)) by[col].push(name);
    } else if (name) {
      others.push(name);
    }
  }
  // O'rnatilgan rollar bazada hali yaratilmagan bo'lsa ham (ensureRoles) — ustun bo'sh qolmasin.
  if (by.teacher.length === 0) by.teacher.push("O'qituvchi");
  if (by.moderator.length === 0) by.moderator.push("Moderator");
  return { columns: NOTIFY_COLUMNS.map((key) => ({ key, roles: by[key] })), others };
}
