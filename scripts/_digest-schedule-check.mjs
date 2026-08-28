// Oyliklar xulosasi QAYSI KUNI yuborilishini tekshiradi — ilovaning
// O'Z `digestPeriodFor()` funksiyasi bilan (ko'chirma emas), preview
// endpointiga `at` berib.
//
//   node scripts/_digest-schedule-check.mjs [dev-url]
//
// Nega alohida tekshiruv: cron 22:00 UTC da ishlaydi, bu Toshkentda
// ERTASI kuni 03:00. Ya'ni "15-kuni yubor" degani UTC bo'yicha 14-kuni
// kechqurun ishga tushish demak. Bir kunlik xato butun oyni o'tkazib
// yuborardi va buni faqat ikki hafta keyin sezardik.
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

// Har bir holat: cron ishga tushgan UTC lahzasi -> kutilgan natija.
// 22:00 UTC — vercel.json dagi jadval ("0 22 * * *").
const CASES = [
  { at: "2026-08-14T22:00:00Z", tashkent: "15-avgust 03:00", expect: "2026-08-15", why: "oy o'rtasi" },
  { at: "2026-08-30T22:00:00Z", tashkent: "31-avgust 03:00", expect: "2026-08-31", why: "avgust oxirgi kuni (31)" },
  { at: "2026-09-29T22:00:00Z", tashkent: "30-sentabr 03:00", expect: "2026-09-30", why: "sentabr oxirgi kuni (30)" },
  { at: "2026-02-27T22:00:00Z", tashkent: "28-fevral 03:00", expect: "2026-02-28", why: "fevral oxirgi kuni (28)" },
  { at: "2028-02-28T22:00:00Z", tashkent: "29-fevral 03:00", expect: "2028-02-29", why: "kabisa yili — 29-fevral" },
  { at: "2026-12-30T22:00:00Z", tashkent: "31-dekabr 03:00", expect: "2026-12-31", why: "yil oxiri" },
  { at: "2026-08-13T22:00:00Z", tashkent: "14-avgust 03:00", expect: null, why: "14-kun — yubormaydi" },
  { at: "2026-08-15T22:00:00Z", tashkent: "16-avgust 03:00", expect: null, why: "16-kun — yubormaydi" },
  { at: "2026-08-31T22:00:00Z", tashkent: "1-sentabr 03:00", expect: null, why: "oy almashdi — yubormaydi" },
  { at: "2026-08-14T10:00:00Z", tashkent: "14-avgust 15:00", expect: null, why: "UTC 14, Toshkent hali 14 — yubormaydi" },
];

let ok = true;
console.log("cron lahzasi (UTC)      Toshkent            kutilgan     natija");
for (const c of CASES) {
  const r = await fetch(`${BASE}/api/sync/cron?preview=digest&at=${encodeURIComponent(c.at)}`, {
    headers: { "x-cron-secret": (process.env.CRON_SECRET || "").trim() },
  });
  const j = await r.json();
  if (!j.ok) { console.error(`  ✗ ${c.at}: ${j.error}`); ok = false; continue; }
  const got = j.wouldSend ? j.period : null;
  const good = got === c.expect;
  if (!good) ok = false;
  console.log(
    `${good ? "✓" : "✗"} ${c.at}  ${c.tashkent.padEnd(18)} ${String(c.expect ?? "—").padEnd(12)} ${String(got ?? "—").padEnd(12)} ${c.why}`,
  );
}
console.log(ok ? "\n✓ Jadval to'g'ri." : "\n✗ Jadvalda xato bor.");
process.exit(ok ? 0 : 1);
