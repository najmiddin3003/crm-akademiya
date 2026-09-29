// Guruhdagi lid xabarlarini BIR MARTA qayta chizadi — yangi tugmalar (29.09.2026:
// CRM holatlari, faqat mumkin bo'lganlari — lib/leadStatus.ts `leadKeyboard`) va
// joriy "Status:" qatori. Foydalanuvchi qarori: "eski 59 ta xabar ham yangilansin".
//
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/refresh-lead-telegram-buttons.mjs
//       — QURUQ: nechta xabar va qaysi holatga qanday tugmalar chiqadi (Telegram'ga hech narsa ketmaydi)
//   … scripts/refresh-lead-telegram-buttons.mjs --apply
//       — Telegram'da tahrirlaydi, har 3 soniyada bittadan
//
// Faqat xabar manzili saqlangan lidlar (`orders.tgMessage`). Telegram bitta
// guruhga minutiga ~20 ta xabar chegarasini qo'yadi — 3 s oraliq bilan 60 ta
// xabar ~3 daqiqa. 429 kelsa lib/telegramApi.ts o'zi kutib qayta uradi.
//
// DIQQAT: `--apply` ni LOKALDA yurgizmang — `.env.local` da prod Telegram
// kaliti, Atlas ko'zgusida esa prod'dagi o'sha `tgMessage` lar bor: haqiqiy
// guruhdagi xabarlar tahrirlanadi. Faqat serverda (`/var/www/crm/current`).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(HERE, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
  }
}

const APPLY = process.argv.includes("--apply");
const { getDb } = await import("@/lib/mongodb");
const { refreshLeadMessage } = await import("@/lib/leadNotify");
const { leadKeyboard } = await import("@/lib/leadStatus");
const { holatOf, holatMeta } = await import("@/lib/leadHolat");

const db = await getDb();
const rows = await db
  .collection("orders")
  .find({ "tgMessage.messageId": { $exists: true } }, { projection: { _id: 0 } })
  .sort({ id: 1 })
  .toArray();

console.log(`Guruhda xabari bor lidlar: ${rows.length}`);
const tally = new Map();
for (const o of rows) {
  const kb = leadKeyboard(o);
  const k = `${holatMeta(holatOf(o)).nom} → ${kb ? kb.inline_keyboard.map((r) => r[0].text).join(" | ") : "(tugmasiz)"}`;
  tally.set(k, (tally.get(k) ?? 0) + 1);
}
for (const [k, n] of tally) console.log(`  ${String(n).padStart(3)} ta: ${k}`);

if (!APPLY) {
  console.log("\nQURUQ — Telegram'ga hech narsa yuborilmadi. Tahrirlash uchun: --apply");
  process.exit(0);
}

let done = 0;
for (const o of rows) {
  // Xato bo'lsa refreshLeadMessage o'zi "[leadNotify] xabar yangilanmadi" deb yozadi.
  await refreshLeadMessage(db, o.id);
  done++;
  if (done % 10 === 0 || done === rows.length) console.log(`  ${done}/${rows.length}`);
  if (done < rows.length) await new Promise((r) => setTimeout(r, 3000));
}
console.log(`Tayyor: ${done} ta xabar qayta chizildi (xato bo'lsa yuqorida [leadNotify] bilan).`);
process.exit(0);
