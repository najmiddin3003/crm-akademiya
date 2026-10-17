import type { Collection, Db } from "mongodb";
import { isStaffBotReady, loadStaffBotConfig } from "@/lib/staffBot/config";
import { notifyStaffTaskReminder } from "@/lib/staffBot/taskNotify";
import { DAY_MS, HOUR_MS, ms, uzTimeOf } from "@/lib/staffTasks";
import { TASKS_COL, type StaffTaskDoc } from "@/lib/staffTasksServer";
import { telegramMuted } from "@/lib/telegramApi";

// TOPSHIRIQ ESLATMALARI — xodimlar botiga (17.10.2026). Foydalanuvchi:
// «muddat yaqinlashganda ham botda eslatma yuboradigan qil».
//
// Kimga: ijrochiga (lib/staffBot/taskNotify.ts → notifyStaffTaskReminder).
// Qachon (Toshkent vaqti bilan):
//   day     — muddatga 1 kun qolganda; topshiriq kamida 2 kunga berilgan bo'lsa;
//   soon    — muddatga 2 soat qolganda; kamida 4 soatga berilgan bo'lsa
//             (qisqa topshiriqda eslatma ma'nosiz — u hali yodida);
//   overdue — muddat o'tdi: qayta muddat va jarima ogohlantirishi;
//   grace   — qayta muddatga 2 soat qolganda — oxirgi imkoniyat, keyin jarima.
// Har biri bir marta: `reminders.<tur>` ga o'sha muddat yoziladi (holat sharti
// bilan — ikki jarayon bir vaqtda ishlasa ham xabar bitta ketadi). Muddat
// o'zgarsa eslatma yangi muddat uchun qaytadan yuboriladi.
//
// TUNDA JIM: 22:00–08:00 xabar ketmaydi, ertalab — hali dolzarb bo'lsa.
// Tunda o'tib ketgan muddat haqida ertalab «muddat o'tdi» keladi.
//
// BOT YO'Q BO'LSA UMUMAN YURMAYDI: xodimlar boti kaliti sozlanmagan yoki
// Telegram'ga yozish o'chiq (sinov sayti — lib/telegramApi.ts →
// telegramMuted) bo'lsa eslatma «yuborildi» deb belgilanmaydi ham —
// ketmagan xabar ketgan bo'lib qolmasin.
//
// Kim chaqiradi: topshiriq avtomatikasi (lib/staffTasksServer.ts →
// runAutomation — CRM ochiq turganda har ~20 s) va server cron'i har 10
// daqiqada (`/api/sync/cron?only=tasks`, deploy/cron-tasks.sh) — CRM yopiq
// paytda ham. HECH QACHON OTMAYDI.

const SOON_BEFORE = 2 * HOUR_MS;
const SOON_MIN_WINDOW = 4 * HOUR_MS;
const DAY_BEFORE = DAY_MS;
const DAY_MIN_WINDOW = 2 * DAY_MS;
const QUIET_FROM = 22;
const QUIET_TO = 8;

type Kind = "day" | "soon" | "overdue" | "grace";

/** Toshkent tuni (22:00–08:00) — eslatma yuborilmaydi. */
export function isQuietHour(nowMs: number): boolean {
  const h = Number(uzTimeOf(nowMs).slice(0, 2));
  return h >= QUIET_FROM || h < QUIET_TO;
}

/** Muddat sanog'ining boshlanishi — berilgan vaqt yoki oxirgi qaytarilgan lahza. */
function windowStartOf(t: StaffTaskDoc): number {
  let s = ms(t.createdAt);
  for (const e of t.history ?? []) {
    if (e.kind === "returned") {
      const a = ms(e.at);
      if (a > s) s = a;
    }
  }
  return s;
}

/**
 * Eslatmani BAND QILADI: holat va muddat o'zgarmagan, `kind` eslatmasi shu
 * muddat uchun hali yozilmagan bo'lsa — yozadi va `true`. `also` — birga
 * belgilanadigan (endi keraksiz bo'lib qolgan) turlar; ular shartga KIRMAYDI
 * — masalan kunlik eslatma allaqachon ketgan bo'lsa ham «2 soat» o'tsin.
 */
async function claim(col: Collection<StaffTaskDoc>, t: StaffTaskDoc, kind: Kind, value: string, also: Kind[] = []): Promise<boolean> {
  const set: Record<string, string> = { [`reminders.${kind}`]: value };
  for (const k of also) set[`reminders.${k}`] = value;
  const r = await col.updateOne(
    { id: t.id, status: t.status, deadline: t.deadline, [`reminders.${kind}`]: { $ne: value } },
    { $set: set },
  );
  return r.modifiedCount === 1;
}

let running = false;

/** Yuborilgan eslatmalar soni. */
export async function runTaskReminders(db: Db, nowMs = Date.now()): Promise<number> {
  if (running || isQuietHour(nowMs)) return 0;
  if (telegramMuted() || !isStaffBotReady(loadStaffBotConfig())) return 0;
  running = true;
  let sent = 0;
  try {
    const col = db.collection<StaffTaskDoc>(TASKS_COL);
    const nowIso = new Date(nowMs).toISOString();

    // 1) Faol topshiriqlar — muddatgacha 1 kun yoki kamroq.
    const near = (await col
      .find(
        { status: { $in: ["yangi", "qaytarildi"] }, deadline: { $gt: nowIso, $lte: new Date(nowMs + DAY_BEFORE).toISOString() } },
        { projection: { _id: 0 } },
      )
      .limit(500)
      .toArray()) as StaffTaskDoc[];
    for (const t of near) {
      const dl = ms(t.deadline);
      const left = dl - nowMs;
      const window = dl - windowStartOf(t);
      // 2 soat ichida — faqat «soon» (kunlik eslatma o'tkazib yuborilgan bo'lsa ham bittasi yetadi).
      const kind: Kind | null =
        left <= SOON_BEFORE ? (window >= SOON_MIN_WINDOW ? "soon" : null) : window >= DAY_MIN_WINDOW ? "day" : null;
      if (!kind || t.reminders?.[kind] === t.deadline) continue;
      // «soon» ketgach kunlik eslatma endi kerak emas.
      if (await claim(col, t, kind, t.deadline, kind === "soon" ? ["day"] : [])) {
        await notifyStaffTaskReminder(db, t, kind, nowMs);
        sent++;
      }
    }

    // 2) Muddati o'tgan — qayta muddat hali tugamagan.
    const late = (await col
      .find({ status: "muddati_otdi", redeadline: { $gt: nowIso } }, { projection: { _id: 0 } })
      .limit(500)
      .toArray()) as StaffTaskDoc[];
    for (const t of late) {
      const re = t.redeadline;
      if (!re) continue;
      const left = ms(re) - nowMs;
      const grace = ms(re) - ms(t.deadline);
      if (t.reminders?.overdue !== re) {
        // «Muddat o'tdi» — qayta muddat va jarima bilan. Oxirgi 2 soat ichida
        // yuborilsa, alohida «grace» eslatma kerak emas (shu xabarning o'zi).
        if (await claim(col, t, "overdue", re, left <= SOON_BEFORE ? ["grace"] : [])) {
          await notifyStaffTaskReminder(db, t, "overdue", nowMs);
          sent++;
        }
        continue;
      }
      if (left <= SOON_BEFORE && grace >= SOON_MIN_WINDOW && t.reminders?.grace !== re) {
        if (await claim(col, t, "grace", re)) {
          await notifyStaffTaskReminder(db, t, "grace", nowMs);
          sent++;
        }
      }
    }
  } catch (e) {
    console.error("[staff-tasks] eslatmalar:", e instanceof Error ? e.message : e);
  } finally {
    running = false;
  }
  return sent;
}
