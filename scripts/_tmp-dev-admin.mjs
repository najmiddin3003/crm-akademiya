// VAQTINCHALIK DEV ADMIN — faqat Atlas KO'ZGUSIDA (mongodb.net), brauzer sinovi uchun.
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_tmp-dev-admin.mjs
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_tmp-dev-admin.mjs --undo
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const s = line.trim(); if (!s || s.startsWith("#")) continue; const i = s.indexOf("="); if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim(); }
if (!/mongodb\.net/.test(process.env.MONGODB_URI || "")) { console.log("MONGODB_URI Atlas emas — TO'XTATILDI (prod'ga yozilmaydi)."); process.exit(1); }
const { getDb } = await import("@/lib/mongodb");
const { setPasswordFields } = await import("@/lib/invite");
const db = await getDb();
const PHONE = "998000000099";
if (process.argv.includes("--undo")) {
  const u = await db.collection("users").findOne({ phone: PHONE }, { projection: { _id: 1 } });
  if (u) await db.collection("user_sessions").deleteMany({ userId: u._id.toString() });
  const r = await db.collection("users").deleteOne({ phone: PHONE });
  console.log("o'chirildi:", r.deletedCount);
} else {
  const fields = await setPasswordFields("Sinov-2026!");
  await db.collection("users").updateOne(
    { phone: PHONE },
    { $set: { phone: PHONE, role: "admin", status: "active", hrEmployeeId: 1, fullName: "Dev Admin", ...fields }, $unset: { adminApproval: "" } },
    { upsert: true },
  );
  console.log("tayyor: telefon 000000099, parol Sinov-2026!");
}
process.exit(0);
