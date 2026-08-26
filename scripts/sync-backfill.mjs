// Bazadagi MAVJUD to'lovlarni Google Sheets'ga ko'chirish.
// TELEGRAM'GA HECH NARSA YUBORILMAYDI — kelishuv shunday: eski tarix
// faqat jadvalda tursin, guruhga faqat yangi to'lovlar kelsin.
//
// Ishga tushirish:
//   node scripts/sync-backfill.mjs              (lokal dev serverga)
//   node scripts/sync-backfill.mjs https://crm.example.com
//
// Ishlash printsipi: skript hech qanday jadvalga o'zi yozmaydi — u
// /api/sync/cron endpoint'ini takror-takror chaqiradi. O'sha endpoint
// bazani jadval bilan solishtirib, yetishmagan qatorlarni qo'shadi.
// Nega shunday? Mantiq bitta joyda (lib/sync/reconcile.ts) tursin:
// skriptda ikkinchi nusxa bo'lsa, ular vaqt o'tib bir-biridan farq
// qilib qolardi va qaysi biri to'g'ri ekani noma'lum bo'lardi.
//
// Bir chaqiruvda 2000 tagacha qator qo'shiladi (serverless vaqt
// chegarasi). Skript "remaining" nolga tushguncha davom etadi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const base = (process.argv[2] || process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = (process.env.CRON_SECRET || "").trim();

if (!secret) {
  console.error("❌ .env.local da CRON_SECRET yo'q — endpoint himoyalangan, kalitsiz chaqirib bo'lmaydi.");
  process.exit(1);
}

console.log(`Manzil: ${base}/api/sync/cron`);
console.log("Telegram'ga xabar YUBORILMAYDI (faqat Google Sheets).\n");

const MAX_ROUNDS = 40;
let round = 0;
let totalAdded = 0;
let totalUpdated = 0;

while (round < MAX_ROUNDS) {
  round += 1;
  process.stdout.write(`[${round}] so'rov yuborilmoqda… `);

  let data;
  try {
    const res = await fetch(`${base}/api/sync/cron`, {
      headers: { "x-cron-secret": secret },
    });
    data = await res.json();
    if (!res.ok || !data.ok) {
      console.error(`\n❌ Xato (${res.status}): ${data?.error || "noma'lum"}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`\n❌ Serverga ulanib bo'lmadi: ${e.message}`);
    console.error("   Dev server ishlab turibdimi? (npm run dev)");
    process.exit(1);
  }

  const reports = data.reports || [];
  const added = reports.reduce((s, r) => s + r.added, 0);
  const updated = reports.reduce((s, r) => s + r.updated, 0);
  const remaining = reports.reduce((s, r) => s + r.remaining, 0);
  const errors = reports.flatMap((r) => r.errors);

  totalAdded += added;
  totalUpdated += updated;

  console.log(`+${added} qo'shildi, ${updated} yangilandi, ${remaining} qoldi (${data.durationMs} ms)`);
  for (const r of reports) {
    console.log(`      ${r.kind.padEnd(8)} baza: ${r.dbCount}, jadval: ${r.sheetCount}`);
  }
  if (errors.length > 0) {
    console.error("   ⚠️  " + errors.join("\n   ⚠️  "));
    process.exit(1);
  }

  if (remaining === 0 && added === 0 && updated === 0) {
    console.log(`\n✅ Tugadi. Jami: ${totalAdded} qo'shildi, ${totalUpdated} yangilandi.`);
    process.exit(0);
  }
}

console.log(`\n⚠️  ${MAX_ROUNDS} ta urinishdan keyin ham tugamadi.`);
console.log("   Skriptni qaytadan ishga tushiring — qolgan joyidan davom etadi.");
