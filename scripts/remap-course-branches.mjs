// BIR MARTALIK MA'LUMOT TUZATISHI — bazaga YOZADI.
// (`_` bilan boshlanmaydi: `scripts/_*.mjs` faqat o'lchov degani.)
//
//   node scripts/remap-course-branches.mjs                 # quruq yurish
//   node scripts/remap-course-branches.mjs --apply         # haqiqatan yozadi
//   node scripts/remap-course-branches.mjs --undo <zaxira.json>   # qaytaradi
//
// ------------------------------------------------------------------
// NIMA VA NEGA (20.09.2026, Qarzdorlar hisoboti uchun — lib/debtors.ts)
//
// `offline_courses` hujjatlaridagi filial ro'yxati ESKI: kurslar import
// qilingan paytdagi `branches` kolleksiyasi uchta yozuvdan iborat edi —
//   id 1 "Akademiya 2-filial"  (enabled: false, narx 0)
//   id 2 "Akademiya 3-filial"  (enabled: false, narx 0)
//   id 3 "Akademiya"           (enabled: true,  narx bor — markazning o'zi)
// Hozirgi filiallar esa: 1 "Akademiya 1 Chortoq", 2 "Akademiya 2 Chortoq",
// 3 "Akademiya 3 Uychi", 4 "Akademiya 4 Uchqo'rg'on". Ya'ni kursdagi id 3
// narxi hozir "Uychi" ostida ko'rinadi, 1-filial (bazadagi butun eski
// ma'lumot shu filialniki — scripts/backfill-branch.mjs) uchun esa narx
// yo'q. Qarzdorlar hisoboti narxni guruh filiali bo'yicha oladi, shu bois
// bu bog'lanish to'g'rilanishi shart.
//
// QOIDA: har kurs (va uning har bosqichi) uchun filial ro'yxati HOZIRGI
// `branches` kolleksiyasidan qayta quriladi:
//   • 1-filial ← eski "Akademiya" (id 3) yozuvining enabled/narxi;
//   • qolgan filiallar — o'chiq, narx 0 (eski 1/2 ham shunday edi).
// Faqat ESKI shakldagi hujjatlar teginadi: barcha yozuv nomlari eski
// ro'yxatdan bo'lsa. Bo'sh ro'yxat (Nemis tili, IT) yoki allaqachon
// hozirgi nomlar bilan saqlangan hujjat — o'zgarmaydi.
//
// XAVFSIZLIK: `--apply` bo'lmasa hech narsa yozilmaydi; yozishdan oldin
// eski hujjatlar zaxira faylga tushadi va `--undo` o'sha fayldan
// `branches`/`levels` ni aynan qaytaradi.
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

const ROOT = path.resolve(import.meta.dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const UNDO_AT = args.indexOf("--undo");
const UNDO_FILE = UNDO_AT >= 0 ? args[UNDO_AT + 1] : null;

/** Eski (import davridagi) filial nomlari — faqat shulardan iborat hujjat ko'chiriladi. */
const LEGACY_NAMES = new Set(["Akademiya 2-filial", "Akademiya 3-filial", "Akademiya"]);
/** Eski "markaz" yozuvi — narxi 1-filialga o'tadi. */
const LEGACY_MAIN = "Akademiya";
const MAIN_BRANCH_ID = 1;

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || "crm_akademiya");
const col = db.collection("offline_courses");

async function main() {
  if (UNDO_FILE) {
    const backup = JSON.parse(fs.readFileSync(UNDO_FILE, "utf8"));
    let n = 0;
    for (const c of backup.courses) {
      const r = await col.updateOne({ id: c.id }, { $set: { branches: c.branches, levels: c.levels } });
      n += r.modifiedCount;
    }
    console.log(`QAYTARILDI: ${n} ta kurs (${backup.courses.length} tadan) — ${UNDO_FILE}`);
    return;
  }

  const branches = await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray();
  if (branches.length === 0) throw new Error("`branches` bo'sh — ko'chirib bo'lmaydi");
  console.log("Hozirgi filiallar:", branches.map((b) => `${b.id}=${b.name}`).join(", "));

  const isLegacyList = (list) => Array.isArray(list) && list.length > 0 && list.every((b) => LEGACY_NAMES.has(String(b.name)));

  /** Eski ro'yxatdan hozirgi ro'yxatni quradi; `key` — "price" yoki "summa". */
  function rebuild(list, key) {
    const main = list.find((b) => String(b.name) === LEGACY_MAIN);
    return branches.map((b) => {
      const isMain = b.id === MAIN_BRANCH_ID && main;
      return { id: b.id, name: b.name, enabled: isMain ? !!main.enabled : false, [key]: isMain ? Number(main[key]) || 0 : 0 };
    });
  }

  const courses = await col.find({}).sort({ id: 1 }).toArray();
  const plan = [];
  for (const c of courses) {
    const courseLegacy = isLegacyList(c.branches);
    const levels = Array.isArray(c.levels) ? c.levels : [];
    const legacyLevels = levels.filter((l) => isLegacyList(l.branches));
    if (!courseLegacy && legacyLevels.length === 0) {
      console.log(`  #${c.id} ${c.name}: eski shakl emas — o'tkazib yuborildi`);
      continue;
    }
    const nextBranches = courseLegacy ? rebuild(c.branches, "price") : c.branches;
    const nextLevels = levels.map((l) => (isLegacyList(l.branches) ? { ...l, branches: rebuild(l.branches, "summa") } : l));
    const oldMain = (c.branches ?? []).find((b) => String(b.name) === LEGACY_MAIN);
    console.log(
      `  #${c.id} ${c.name}: kurs narxi ${oldMain ? oldMain.price : "—"} → 1-filial` +
        (legacyLevels.length ? `; bosqichlar: ${legacyLevels.map((l) => `${l.name}=${(l.branches.find((b) => String(b.name) === LEGACY_MAIN) ?? {}).summa ?? "—"}`).join(", ")}` : ""),
    );
    plan.push({ id: c.id, name: c.name, old: { branches: c.branches, levels: c.levels }, next: { branches: nextBranches, levels: nextLevels } });
  }

  console.log(`\n${APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ==="}  o'zgaradigan kurslar: ${plan.length}`);
  if (plan.length === 0) return;

  if (!APPLY) {
    console.log("Hech narsa o'zgartirilmadi. Qo'llash uchun: --apply");
    return;
  }

  // Zaxira faqat haqiqiy yozishdan oldin (quruq yurishda fayl qoldirilmaydi).
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(ROOT, "scripts", `_course-branches-backup-${stamp}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ at: new Date().toISOString(), courses: plan.map((p) => ({ id: p.id, name: p.name, ...p.old })) }, null, 2),
  );
  console.log("Zaxira:", backupPath);

  let n = 0;
  for (const p of plan) {
    const r = await col.updateOne({ id: p.id }, { $set: { branches: p.next.branches, levels: p.next.levels } });
    n += r.modifiedCount;
  }
  console.log(`YOZILDI: ${n} ta kurs. Qaytarish: node scripts/remap-course-branches.mjs --undo ${backupPath}`);
}

try {
  await main();
} finally {
  await client.close();
}
