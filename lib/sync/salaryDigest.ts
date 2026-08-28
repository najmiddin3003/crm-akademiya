import type { Db } from "mongodb";
import { isTelegramReady, loadSyncConfig } from "@/lib/sync/config";
import { buildPayrollRows } from "@/lib/payrollSources";
import {
  payrollDue,
  payrollEarned,
  payrollPaid,
  payrollPeriod,
  payrollTax,
  type EmployeePayroll,
  type PayrollPeriod,
} from "@/lib/salary";
import { esc, sendMessage } from "@/lib/sync/telegram";

// OYLIKLAR XULOSASI — "O'qituvchilar oyliklari" topikiga oyda IKKI MARTA.
//
// Ilgari har bir avans/oylik alohida xabar bo'lib o'sha topikka tushardi
// (avgust oyida 231 ta). Foydalanuvchi topikni boshqa maqsad uchun
// ochgan: bir qarashda "kim qancha ishlab topdi, qancha oldi, qancha
// qoldi" ko'rinishi uchun. Shuning uchun endi u yerga faqat shu modul
// yozadi (config.ts, TELEGRAM_KINDS).
//
// ── QACHON ───────────────────────────────────────────────────────────
// Oyning 15-kuni va oxirgi kuni, Toshkent vaqti bilan. Vercel cron'i
// `0 22 * * *` — bu 22:00 UTC, ya'ni Toshkentda ERTASI kuni 03:00.
// Shu sabab sana MAJBURAN +5 qilib o'qiladi: server UTC'da ishlaydi va
// `new Date().getDate()` u yerda boshqa kunni ko'rsatadi.
//
// ── NEGA BELGI KERAK ────────────────────────────────────────────────
// Cron kuniga bir marta chaqiriladi degan taxminga TAYANIB BO'LMAYDI:
// `sync_runs` da bir kunda 25 ta yugurish bor, 11 tasi olti daqiqa
// ichida (scripts/sync-backfill.mjs endpointni sikl bilan uradi).
// Oddiy "bugun 15-kunmi?" tekshiruvi o'sha kuni 11 ta bir xil xabar
// yuborardi. Shuning uchun `sync_digests` da davr kaliti bo'yicha
// UNIKAL hujjat olinadi va faqat uni YARATGAN chaqiruv xabar yuboradi.

const TASHKENT_OFFSET_MS = 5 * 3_600_000; // UTC+5, yil bo'yi o'zgarmaydi
const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
/** Telegram chegarasi 4096; bo'lish uchun zaxira bilan. */
const MAX_CHARS = 3500;
/** Egasiz qolgan "band qilindi" belgisi shuncha vaqtdan keyin bo'shaydi. */
const STALE_MS = 10 * 60_000;

export interface DigestPeriod {
  /** `sync_digests.period` — davr kaliti, masalan "2026-08-15". */
  key: string;
  /** Sarlavhada ko'rinadigan matn. */
  label: string;
  /** Toshkent vaqtidagi sana — oylik hisobi shu kunga qarab. */
  at: Date;
}

/**
 * Bugun xulosa yuboriladigan kunmi? Bo'lmasa `null`.
 *
 * Oyning 15-kuni — oy o'rtasi; oyning oxirgi kuni — yakun. Oxirgi kun
 * har oyda boshqacha (28/29/30/31), shuning uchun cron ifodasida emas,
 * shu yerda hisoblanadi.
 */
export function digestPeriodFor(now: Date = new Date()): DigestPeriod | null {
  const t = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  // UTC getterlar SHART: `t` allaqachon Toshkentga surilgan, lokal
  // getterlar esa serverning o'z mintaqasini yana qo'shib yuborardi.
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const d = t.getUTCDate();
  const daysIn = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  if (d !== 15 && d !== daysIn) return null;

  const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const label = d === 15
    ? `${UZ_MONTHS[m]} ${y} — oy o'rtasi (1–15)`
    : `${UZ_MONTHS[m]} ${y} — oy yakuni (1–${daysIn})`;
  return { key, label, at: t };
}

/** Bitta xodim uchun xulosa qatoridagi raqamlar. */
interface Line {
  name: string;
  turi: string;
  percent: number;
  salaryType: "foiz" | "fixed";
  earned: number;
  paid: number;
  due: number;
  tax: number;
}

function lineOf(e: EmployeePayroll, p: PayrollPeriod): Line {
  return {
    name: e.name,
    turi: e.turi,
    percent: e.percent,
    salaryType: e.salaryType,
    earned: payrollEarned(e, p),
    paid: payrollPaid(e),
    due: payrollDue(e, p),
    tax: payrollTax(e, p),
  };
}

const money = (n: number): string =>
  (n < 0 ? "−" : "") + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/**
 * Xulosa qatorlarini tayyorlaydi.
 *
 * Sozlanmagan xodim (oyligi ham, foizi ham yo'q) TUSHMAYDI: uning
 * raqamlari 0 bo'lib ko'rinardi va bu "hech narsa ishlamadi" degan
 * noto'g'ri taassurot berardi. Harakat bo'lmagan xodim ham tushmaydi.
 */
export async function digestLines(db: Db, at: Date): Promise<{ teachers: Line[]; others: Line[]; period: PayrollPeriod }> {
  const p = payrollPeriod(at);
  const rows = await buildPayrollRows(db);
  const lines = rows
    .filter((e) => e.configured)
    .map((e) => lineOf(e, p))
    .filter((l) => l.earned !== 0 || l.paid !== 0 || l.due !== 0)
    .sort((a, b) => b.due - a.due);
  return {
    teachers: lines.filter((l) => l.turi === "teacher"),
    others: lines.filter((l) => l.turi !== "teacher"),
    period: p,
  };
}

/** Bir xodim — ikki qator: ismi, ostida raqamlari. */
function itemsOf(lines: Line[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const tag = l.salaryType === "foiz" ? `${l.percent}%` : "oklad";
    // Soliq faqat bor bo'lsa ko'rsatiladi — aks holda "hisoblangan −
    // olingan = qolgan" ayirmasi o'quvchiga tushunarsiz bo'lib qolardi.
    const tax = l.tax > 0 ? ` · soliq ${money(l.tax)}` : "";
    out.push(
      `• <b>${esc(l.name)}</b> (${tag})\n` +
      `   hisoblangan ${money(l.earned)}${tax} · olingan ${money(l.paid)} · <b>qolgan ${money(l.due)}</b>`,
    );
  }
  return out;
}

/**
 * Xabar matni (yoki uzun bo'lsa bir nechta matn).
 *
 * Telegram bitta xabarga 4096 belgi beradi va OSHIB KETSA hech narsa
 * yubormaydi — qisqartirmaydi, butun xabarni rad etadi. Shuning uchun
 * chegaraga yaqinlashganda bo'linadi. Hozir ~41 xodimda ~3 000 belgi
 * chiqadi, ya'ni zaxira bor, lekin xodim soni o'sishi mumkin.
 */
export function digestMessages(period: DigestPeriod, data: { teachers: Line[]; others: Line[]; period: PayrollPeriod }): string[] {
  const all = [...data.teachers, ...data.others];
  const jamiQolgan = all.reduce((s, l) => s + Math.max(l.due, 0), 0);
  const jamiOlingan = all.reduce((s, l) => s + l.paid, 0);
  const qarzdor = all.filter((l) => l.due < 0).length;

  const head = [
    `🧾 <b>Xodimlar oyligi</b>`,
    `📅 ${esc(period.label)} · ${data.period.day}/${data.period.daysIn} kun`,
    "",
  ];
  const foot = [
    "",
    `💰 To'lanishi kerak: <b>${money(jamiQolgan)} so'm</b>`,
    `✅ Shu oyda berilgan: <b>${money(jamiOlingan)} so'm</b>`,
    ...(qarzdor > 0 ? [`⚠️ ${qarzdor} xodimda ortiqcha olingan (manfiy qoldiq)`] : []),
  ];

  const sections = [
    { title: "O'qituvchilar", items: itemsOf(data.teachers), count: data.teachers.length },
    { title: "Boshqa xodimlar", items: itemsOf(data.others), count: data.others.length },
  ].filter((s) => s.count > 0);

  // Bo'lish. Bo'lim sarlavhasi har bo'lakda QAYTA yoziladi ("davomi"
  // bilan) — aks holda ikkinchi xabar sarlavhasiz ro'yxat bo'lib
  // boshlanardi va o'quvchi kimning ro'yxatini ko'rayotganini bilmasdi.
  const chunks: string[][] = [[]];
  let size = head.join("\n").length + foot.join("\n").length;
  const push = (part: string) => {
    if (size + part.length > MAX_CHARS && chunks[chunks.length - 1].length > 0) {
      chunks.push([]);
      size = 0;
    }
    chunks[chunks.length - 1].push(part);
    size += part.length + 1;
  };

  for (const s of sections) {
    let openedIn = -1;
    for (const item of s.items) {
      const before = chunks.length;
      push(item);
      const now = chunks.length;
      if (openedIn === -1 || now !== before) {
        // Yangi bo'lakda (yoki eng boshida) bo'lim sarlavhasini qo'yamiz.
        const head = openedIn === -1
          ? `<b>${esc(s.title)}</b> — ${s.count} ta`
          : `<b>${esc(s.title)}</b> (davomi)`;
        chunks[chunks.length - 1].splice(chunks[chunks.length - 1].length - 1, 0, head);
        size += head.length + 1;
        openedIn = chunks.length;
      }
    }
    if (chunks[chunks.length - 1].length > 0) push("");
  }

  return chunks.map((c, i) => {
    const marker = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : "";
    const h = i === 0
      ? [head[0] + marker, ...head.slice(1)]
      : [`🧾 <b>Xodimlar oyligi</b>${marker}`, ""];
    const f = i === chunks.length - 1 ? foot : [];
    return [...h, ...c, ...f].join("\n").trimEnd();
  });
}

export interface DigestResult {
  sent: boolean;
  period?: string;
  reason?: string;
  messageIds?: number[];
  error?: string;
}

/**
 * Kunlik cron shuni chaqiradi. XATO OTMAYDI — sinxronizatsiyaning
 * qolgan qismi (Google Sheets solishtirishi) xulosa tufayli to'xtab
 * qolmasligi kerak.
 */
export async function runSalaryDigest(db: Db, now: Date = new Date()): Promise<DigestResult> {
  const period = digestPeriodFor(now);
  if (!period) return { sent: false, reason: "bugun xulosa kuni emas" };

  const cfg = loadSyncConfig();
  if (!isTelegramReady(cfg, "salary")) {
    return { sent: false, period: period.key, reason: "Telegram sozlanmagan" };
  }

  const col = db.collection("sync_digests");
  const nowIso = new Date().toISOString();

  // Davrni BAND QILAMIZ. `upsert` + unikal indeks: hujjat yo'q bo'lsa
  // shu chaqiruv yaratadi va `before` null qaytadi — egalik shunda.
  // Bir vaqtda kelgan ikkinchi chaqiruvda hujjat allaqachon bor.
  const before = await col.findOneAndUpdate(
    { period: period.key },
    {
      $setOnInsert: {
        period: period.key, label: period.label,
        claimedAt: nowIso, sentAt: null, messageIds: [], attempts: 0, error: null,
      },
    },
    { upsert: true, returnDocument: "before" },
  );

  let owned = before === null;
  if (before !== null) {
    if (before.sentAt) return { sent: false, period: period.key, reason: "allaqachon yuborilgan" };
    // Oldingi urinish yuborishga ulgurmay uzilgan bo'lsa egalikni olamiz.
    const stale = new Date(Date.now() - STALE_MS).toISOString();
    const taken = await col.findOneAndUpdate(
      { period: period.key, sentAt: null, claimedAt: { $lt: stale } },
      { $set: { claimedAt: nowIso }, $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
    owned = taken !== null;
    if (!owned) return { sent: false, period: period.key, reason: "boshqa yugurish band qilib turibdi" };
  }

  try {
    const data = await digestLines(db, period.at);
    if (data.teachers.length === 0 && data.others.length === 0) {
      await col.updateOne({ period: period.key }, { $set: { sentAt: nowIso, messageIds: [], error: null, empty: true } });
      return { sent: false, period: period.key, reason: "bu oyda harakat yo'q" };
    }
    const target = cfg.targets.salary;
    const ids: number[] = [];
    for (const text of digestMessages(period, data)) {
      const res = await sendMessage(cfg, target.chatId, text, target.threadId);
      ids.push(res.messageId);
      // Telegram guruhga daqiqasiga ~20 xabar beradi; bo'laklar orasida
      // kichik pauza limitga urilishdan saqlaydi.
      await new Promise((r) => setTimeout(r, 300));
    }
    await col.updateOne({ period: period.key }, { $set: { sentAt: new Date().toISOString(), messageIds: ids, error: null } });
    return { sent: true, period: period.key, messageIds: ids };
  } catch (e) {
    const error = e instanceof Error ? e.message : "noma'lum xato";
    // `sentAt` null qoladi — keyingi yugurish (belgi eskirgach) qayta uradi.
    await col.updateOne({ period: period.key }, { $set: { error } });
    console.error("[sync] oyliklar xulosasi yuborilmadi:", error);
    return { sent: false, period: period.key, error };
  }
}
