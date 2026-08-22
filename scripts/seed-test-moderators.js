// Bir martalik skript: MongoDB `hr_employees` kolleksiyasiga 5 ta test
// moderator qo'shadi (`turi: "moderator"`).
//
// Moderator ham xodim — alohida kolleksiya yo'q. Buyurtmalar ro'yxatidagi
// "Moderator" filtri /api/hr-employees dan aynan shu yozuvlarni oladi.
//
// IDEMPOTENT: ismi bo'yicha allaqachon bor xodim qayta qo'shilmaydi.
//
// Ishga tushirish: node scripts/seed-test-moderators.js
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

const MODERATORS = [
  { name: "Dilmurod Komilov", gender: "male", phone: "94 611 20 45", created: "09.01.2026 | 10:12" },
  { name: "Nilufar Sharipova", gender: "female", phone: "93 728 55 09", created: "24.01.2026 | 15:38" },
  { name: "Sanjar Tolipov", gender: "male", phone: "90 304 88 71", created: "12.02.2026 | 09:05" },
  { name: "Kamola Ergasheva", gender: "female", phone: "97 519 63 24", created: "07.03.2026 | 13:47" },
  { name: "Javohir Yusupov", gender: "male", phone: "99 862 41 30", created: "28.03.2026 | 11:26" },
];

(async () => {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI topilmadi (.env.local)");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "crm_akademiya");
  const col = db.collection("hr_employees");
  await col.createIndex({ id: 1 }, { unique: true });

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  let nextId = (last[0]?.id ?? 0) + 1;

  let added = 0;
  let skipped = 0;
  for (const m of MODERATORS) {
    const exists = await col.findOne({ name: m.name });
    if (exists) {
      skipped++;
      console.log(`- o'tkazib yuborildi (bor): ${m.name} (id ${exists.id})`);
      continue;
    }
    await col.insertOne({
      id: nextId,
      name: m.name,
      gender: m.gender,
      aktivOq: 0,
      groups: 0,
      turi: "moderator",
      filial: "Akademiya",
      phone: m.phone,
      kurs: "",
      created: m.created,
      lastActive: "",
      archReason: "",
      archDate: "",
      email: "",
      percent: "",
      degree: "",
      photoUrl: "",
      branchAssignments: [],
    });
    console.log(`+ qo'shildi: ${m.name} (id ${nextId})`);
    nextId++;
    added++;
  }

  const total = await col.countDocuments({ turi: "moderator" });
  console.log(`\nQo'shildi: ${added}, o'tkazib yuborildi: ${skipped}. Bazadagi jami moderatorlar: ${total}`);
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
