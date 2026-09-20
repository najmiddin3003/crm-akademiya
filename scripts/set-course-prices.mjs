// KURS NARXLARINI RASMIY RO'YXATDAN YOZISH — bazaga YOZADI.
// (`_` bilan boshlanmaydi: `scripts/_*.mjs` faqat o'lchov degani.)
//
//   node scripts/set-course-prices.mjs                    # quruq yurish (hamma filial)
//   node scripts/set-course-prices.mjs --branches 1,2,3   # faqat shu filiallar
//   node scripts/set-course-prices.mjs --apply            # haqiqatan yozadi
//   node scripts/set-course-prices.mjs --undo <zaxira.json>
//
// ------------------------------------------------------------------
// NIMA VA NEGA (20.09.2026, Qarzdorlar hisoboti uchun — lib/debtors.ts)
//
// Manba — "AKADEMIYA 2026–2027 o'quv yili KURS NARXLARI" rasmi (foydalanuvchi
// yubordi), OYLIK narxlar. Bazada (`offline_courses`) ham 20.09.2026 dan
// OYLIK narx saqlanadi (birinchi yurgizishda oylik ÷ 13 = "bitta dars
// narxi" yozilgan edi — Edutizim importidagi 21 538 = 280 000/13 kabi).
// Bitta dars narxini hisobot o'zi chiqaradi: oylik ÷ guruh jadvalidagi
// oylik darslar soni (lib/debtorsTypes.ts → lessonsPerMonthFor: haftasiga
// 3 kun → 13, 5 kun → 22, 2 kun → 9) — har kuni o'qiydigan "topik" ham
// oyiga aynan 400 000 to'laydi, 22 × 30 769 emas. Qayta yurgizish
// XAVFSIZ: mavjud qiymat qanday bo'lishidan qat'i nazar ro'yxatdagi oylik
// narx yoziladi.
//
// Kurs hujjatlaridagi filial ro'yxati ESKI edi (import davridagi uchta
// yozuv: "Akademiya 2-filial", "Akademiya 3-filial", "Akademiya" — narx faqat
// oxirgisida, u hozirgi id 3 "Uychi" ga to'g'ri kelib qolgan). Bu skript
// ro'yxatni HOZIRGI `branches` kolleksiyasidan qayta quradi va tanlangan
// filiallar uchun narxni ro'yxatdan yozadi; tanlanmagan filialda mavjud
// yozuv (id bo'yicha) saqlanadi, bo'lmasa o'chiq/0.
//
// Oilalar (ro'yxatdagi uch jadval):
//   ARAB   — Arab tili;
//   FANLAR — Biologiya, Sertifikat, Tarix, Huquq, Matematika, Ona tili,
//            Geografiya, Kimyo, Fizika;
//   CHET   — Ingliz, Rus, Koreys, Turk, Nemis tili ("Sertifikat" bosqichi =
//            "IELTS / CEFR tayyorlov" narxi).
// Ro'yxatda yo'q kurs (IT (Web dizayn)) TEGILMAYDI. Ro'yxatda yo'q bosqich
// o'z holicha qoladi va chiqishda ko'rsatiladi. Oilada bo'lib, bosqichi
// UMUMAN yo'q kurs (Nemis tili) uchun bosqichlar o'sha oiladagi namuna
// kursdan (nomi va rangi) ko'chiriladi — aks holda unga bosqichli guruh
// ochib bo'lmasdi.
//
// Kurs darajasidagi narx (bosqichsiz guruhlar uchun — masalan 4-filialning
// barcha guruhlari) — oilaning ENG PAST qatori (280 000).
//
// XAVFSIZLIK: `--apply` bo'lmasa hech narsa yozilmaydi; yozishdan oldin
// eski `branches`/`levels` zaxira faylga tushadi, `--undo` aynan qaytaradi.
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
const BR_AT = args.indexOf("--branches");
const ONLY_BRANCHES = BR_AT >= 0 ? String(args[BR_AT + 1] || "").split(",").map(Number).filter(Number.isFinite) : null;

/** Bazaga OYLIK narxning o'zi yoziladi (yuqoridagi izoh). */
const stored = (monthly) => monthly;

/** Rasmdagi OYLIK narxlar (so'm). Kalit — bazadagi bosqich nomi (kichik harfda solishtiriladi). */
const FAMILIES = {
  ARAB: {
    base: 280000,
    levels: {
      "1-4-sinflar (kichik guruh)": 280000,
      "5-sinf va yuqori (katta guruh)": 300000,
    },
  },
  FANLAR: {
    base: 280000,
    levels: {
      "1-4-sinflar": 280000,
      "5-8-sinflar": 300000,
      "9-11-sinflar": 320000,
      "Majburiy fanlar": 320000,
      "Milliy sertifikat": 400000,
      "Prezident maktablari": 280000,
    },
  },
  CHET: {
    base: 280000,
    levels: {
      "Kichik guruh": 280000,
      "Katta guruh 1/2-bosqich": 320000,
      "Katta guruh 3/4-bosqich": 350000,
      "Katta guruh 5/6-bosqich": 400000,
      "IELTS / CEFR tayyorlov": 400000,
      Sertifikat: 400000,
    },
    /** Bosqichi yo'q kursga bosqichlar shu kursdan ko'chiriladi. */
    template: "Turk tili",
  },
};

const FAMILY_OF = {
  "arab tili": "ARAB",
  "ingliz tili": "CHET",
  "rus tili": "CHET",
  "koreys tili": "CHET",
  "turk tili": "CHET",
  "nemis tili": "CHET",
  biologiya: "FANLAR",
  sertifikat: "FANLAR",
  tarix: "FANLAR",
  huquq: "FANLAR",
  matematika: "FANLAR",
  "ona tili": "FANLAR",
  geografiya: "FANLAR",
  kimyo: "FANLAR",
  fizika: "FANLAR",
};

const norm = (s) => String(s ?? "").trim().toLowerCase();

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
  if (branches.length === 0) throw new Error("`branches` bo'sh");
  const selected = ONLY_BRANCHES ? branches.filter((b) => ONLY_BRANCHES.includes(b.id)) : branches;
  if (selected.length === 0) throw new Error("--branches ro'yxatidan bittasi ham bazada yo'q");
  console.log("Filiallar:", branches.map((b) => `${b.id}=${b.name}${selected.includes(b) ? " ✓" : ""}`).join(", "));

  const courses = await col.find({}).sort({ id: 1 }).toArray();
  const byName = new Map(courses.map((c) => [norm(c.name), c]));

  /** Hozirgi filial ro'yxatini quradi: tanlanganlarga ro'yxat narxi, qolganlarga eski yozuv (id bo'yicha) yoki o'chiq/0. */
  function rebuild(oldList, key, monthly) {
    const old = new Map((oldList ?? []).map((b) => [Number(b.id), b]));
    return branches.map((b) => {
      if (selected.includes(b)) return { id: b.id, name: b.name, enabled: true, [key]: stored(monthly) };
      const prev = old.get(b.id);
      // Eski nomli (import davridagi) yozuv id bo'yicha mos kelsa ham u
      // boshqa filialniki — faqat nomi hozirgi bilan bir xil bo'lsa saqlanadi.
      return prev && prev.name === b.name
        ? { id: b.id, name: b.name, enabled: !!prev.enabled, [key]: Number(prev[key]) || 0 }
        : { id: b.id, name: b.name, enabled: false, [key]: 0 };
    });
  }

  const fmtBr = (list, key) => list.filter((b) => b.enabled).map((b) => `${b.id}:${b[key]}`).join(" ") || "—";

  const plan = [];
  for (const c of courses) {
    const famKey = FAMILY_OF[norm(c.name)];
    if (!famKey) {
      console.log(`\n#${c.id} ${c.name}: ro'yxatda yo'q — TEGILMAYDI`);
      continue;
    }
    const fam = FAMILIES[famKey];
    const levelPrice = new Map(Object.entries(fam.levels).map(([k, v]) => [norm(k), v]));

    let levels = Array.isArray(c.levels) ? c.levels : [];
    let cloned = false;
    if (levels.length === 0 && fam.template) {
      const tpl = byName.get(norm(fam.template));
      if (tpl && Array.isArray(tpl.levels) && tpl.levels.length) {
        levels = tpl.levels.map((l, i) => ({ id: i + 1, name: l.name, color: l.color || "#000000", branches: [] }));
        cloned = true;
      }
    }

    const nextBranches = rebuild(c.branches, "price", fam.base);
    const nextLevels = [];
    const notes = [];
    for (const l of levels) {
      const monthly = levelPrice.get(norm(l.name));
      if (monthly === undefined) {
        notes.push(`bosqich "${l.name}" ro'yxatda yo'q — o'z holicha`);
        nextLevels.push(l);
        continue;
      }
      nextLevels.push({ ...l, branches: rebuild(l.branches, "summa", monthly) });
    }

    console.log(`\n#${c.id} ${c.name} [${famKey}]${cloned ? ` — bosqichlar "${fam.template}" dan ko'chirildi` : ""}`);
    console.log(`  kurs: ${fmtBr(c.branches ?? [], "price")}  →  ${fmtBr(nextBranches, "price")}   (${fam.base.toLocaleString("ru-RU")}/oy)`);
    for (let i = 0; i < nextLevels.length; i++) {
      const before = levels[i];
      const after = nextLevels[i];
      const monthly = levelPrice.get(norm(after.name));
      console.log(`  ${after.name}: ${fmtBr(before.branches ?? [], "summa")}  →  ${fmtBr(after.branches ?? [], "summa")}${monthly ? `   (${monthly.toLocaleString("ru-RU")}/oy)` : ""}`);
    }
    for (const n of notes) console.log(`  ! ${n}`);
    plan.push({ id: c.id, name: c.name, old: { branches: c.branches ?? [], levels: c.levels ?? [] }, next: { branches: nextBranches, levels: nextLevels } });
  }

  console.log(`\n${APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ==="}  o'zgaradigan kurslar: ${plan.length}`);
  if (plan.length === 0) return;
  if (!APPLY) {
    console.log("Hech narsa o'zgartirilmadi. Qo'llash uchun: --apply");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(ROOT, "scripts", `_course-prices-backup-${stamp}.json`);
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
  console.log(`YOZILDI: ${n} ta kurs. Qaytarish: node scripts/set-course-prices.mjs --undo ${backupPath}`);
}

try {
  await main();
} finally {
  await client.close();
}
