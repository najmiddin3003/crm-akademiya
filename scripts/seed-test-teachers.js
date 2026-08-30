// Bir martalik skript: MongoDB `hr_employees` kolleksiyasiga 5 ta test
// o'qituvchi qo'shadi (`turi: "teacher"`).
//
// O'qituvchilar uchun alohida kolleksiya YO'Q — o'qituvchi ham xodim, shuning
// uchun ular Boshqaruv → Xodimlar roster'ida turadi va /api/teachers o'sha
// yerdan `turi: "teacher"` yozuvlarni qaytaradi. Ilgari buyurtma formasidagi
// "O'qituvchi" ro'yxati qattiq yozilgan massivdan kelardi (lib/ordersData.ts →
// TEACHERS) — u olib tashlandi.
//
// IDEMPOTENT: ismi bo'yicha allaqachon bor xodim qayta qo'shilmaydi.
//
// Ishga tushirish: node scripts/seed-test-teachers.js
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

// `percent` — Sozlamalar → Moliya → Oylik foizlaridagi DARAJA NOMI
// (lib/payrollSources.ts uni foizga aylantiradi), `salary: 0` — oklad
// sozlanmagan: o'qituvchi tushumdan foiz oladi (lib/salary.ts).
// roleId 2 = "o'qituvchi" (`roles`), branchId 1 = "Akademiya" (`branches`),
// scheduleId 1 = mavjud ish jadvali (`work_schedules`).
const TEACHERS = [
  { name: "Otabek Rasulov",     gender: "male",   phone: "94 210 34 51", kurs: "Ingliz tili", percent: "50 foiz", created: "14.01.2026 | 09:20" },
  { name: "Dilnoza Karimova",   gender: "female", phone: "93 465 72 08", kurs: "Matematika",  percent: "40 foiz", created: "03.02.2026 | 11:45" },
  { name: "Shohrux Aliyev",     gender: "male",   phone: "97 128 90 63", kurs: "Rus tili",    percent: "50 foiz", created: "22.02.2026 | 14:10" },
  { name: "Madina Yo'ldosheva", gender: "female", phone: "90 583 16 27", kurs: "Arab tili",   percent: "60 foiz", created: "11.03.2026 | 08:35" },
  { name: "Ulug'bek Sharipov",  gender: "male",   phone: "99 347 05 89", kurs: "Fizika",      percent: "40 foiz", created: "05.04.2026 | 16:02" },
];

(async () => {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI topilmadi (.env.local)");
  const client = new MongoClient(uri, { maxPoolSize: 5 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "crm_akademiya");
  const col = db.collection("hr_employees");
  await col.createIndex({ id: 1 }, { unique: true });

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  let nextId = (last[0]?.id ?? 0) + 1;

  let added = 0;
  let skipped = 0;
  for (const t of TEACHERS) {
    const exists = await col.findOne({ name: t.name });
    if (exists) {
      skipped++;
      console.log(`- o'tkazib yuborildi (bor): ${t.name} (id ${exists.id})`);
      continue;
    }
    await col.insertOne({
      id: nextId,
      name: t.name,
      gender: t.gender,
      aktivOq: 0,
      groups: 0,
      turi: "teacher",
      filial: "Akademiya",
      phone: t.phone,
      kurs: t.kurs,
      created: t.created,
      lastActive: "",
      archReason: "",
      archDate: "",
      email: "",
      percent: t.percent,
      degree: "",
      photoUrl: "",
      branchAssignments: [{ branchId: 1, roleId: 2, scheduleId: 1, salary: 0 }],
    });
    console.log(`+ qo'shildi: ${t.name} (id ${nextId}, ${t.kurs})`);
    nextId++;
    added++;
  }

  const total = await col.countDocuments({ turi: "teacher" });
  console.log(`\nQo'shildi: ${added}, o'tkazib yuborildi: ${skipped}. Bazadagi jami o'qituvchilar: ${total}`);
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
