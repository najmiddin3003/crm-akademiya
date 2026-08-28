// Oyliklar xulosasini YUBORMASDAN ko'rsatadi — ilovaning O'Z kodi bilan
// (ko'chirma emas), `/api/sync/cron?preview=digest` orqali.
//
//   node scripts/_digest-preview.mjs [dev-url]
//
// HTML teglari olib tashlanib chiqariladi, chunki terminalda ular
// faqat xalaqit beradi; belgilar soni esa TEG BILAN emas, Telegram
// hisoblaydigan holatda (teglarsiz) ko'rsatiladi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const l of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const s = l.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const r = await fetch(`${BASE}/api/sync/cron?preview=digest`, {
  headers: { "x-cron-secret": (process.env.CRON_SECRET || "").trim() },
});
const j = await r.json();
if (!j.ok) {
  console.error(`❌ ${r.status}: ${j.error ?? JSON.stringify(j).slice(0, 200)}`);
  process.exit(1);
}

console.log(`Davr    : ${j.period}`);
console.log(`Xodimlar: ${j.teachers} o'qituvchi + ${j.others} boshqa`);
console.log(`Xabar   : ${j.messages.length} ta\n`);

j.messages.forEach((m, i) => {
  // Telegram 4096 belgini TEGLARSIZ sanaydi.
  const plain = m.replace(/<[^>]+>/g, "");
  console.log(`${"─".repeat(58)}\n${i + 1}-xabar · ${plain.length} belgi (chegara 4096)\n${"─".repeat(58)}`);
  console.log(plain);
  console.log();
});
