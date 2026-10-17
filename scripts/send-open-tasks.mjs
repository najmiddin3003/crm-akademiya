// OCHIQ TOPSHIRIQLARNI XODIMLAR BOTIGA YUBORISH — BIR MARTALIK (17.10.2026).
//
// Foydalanuvchi: «hali ochiq turgan topshiriqlarni xodimlarga yuborib qo'y,
// qaysi xodim botdan kirgan bo'lsa o'sha xodimlarga». Bot topshiriqlarni
// bilgunga qadar (b05cce9) berilgan topshiriqlar haqida xodimlarda xabar yo'q:
//   faol (yangi, qaytarildi, muddati o'tdi) → ijrochiga «Sizda ochiq topshiriq
//   bor» (✅ Bajardim tugmasi bilan);
//   tasdiq kutayotgan → topshiriq berganga (✅ Tasdiqlash / ↩️ Qaytarish).
// Faqat @akademiya_crm_bot ga KIRGAN (staff_bot_users, stage "in") va uni
// bloklamagan xodimlar; botni hali ochmagan xodimga yozib bo'lmaydi (403 →
// `blocked`, keyingi pushlar ham u /start bosguncha o'tkaziladi).
//
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/send-open-tasks.mjs          — faqat SANAYDI
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/send-open-tasks.mjs --apply  — YUBORADI
//
// Ikki marta `--apply` — ikki marta yuboradi (belgi qo'yilmaydi).
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

const apply = process.argv.includes("--apply");
const { getDb } = await import("@/lib/mongodb");
const { pushOpenTasks } = await import("@/lib/staffBot/taskNotify");
const { staffBotUsername } = await import("@/lib/staffBot/config");

const db = await getDb();
const r = await pushOpenTasks(db, { apply });
console.log(`Bot: @${staffBotUsername()} — ${apply ? "YUBORILDI" : "faqat sanaldi (--apply yo'q)"}`);
console.log(`  ochiq topshiriqlar: faol ${r.active}, tasdiq kutayotgan ${r.waiting}`);
console.log(`  botga kirgan suhbatlar: ${r.targets}; botda yo'q xodimning topshiriqlari: ${r.noTarget}`);
if (apply) console.log(`  yuborildi: ${r.sent}; botni ochmagan/bloklagan: ${r.blocked}; boshqa xato: ${r.failed}`);
process.exit(0);
