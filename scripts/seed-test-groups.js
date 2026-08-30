// Bir martalik skript: MongoDB `groups` kolleksiyasiga 2 ta test guruh
// qo'shadi va ularga bazadagi test o'quvchilarni biriktiradi.
//
// Guruhlar avtomatik seed qilinmaydi (demo seed hamma route'lardan olib
// tashlangan), shu bois Topshiriq oynasidagi "Guruh" tanlovi va O'quvchilar
// ro'yxatidagi kurs/o'qituvchi/kun ustunlari uchun haqiqiy yozuv kerak.
//
// O'qituvchilar scripts/seed-test-teachers.js dan, o'quvchilar
// scripts/seed-test-pupils.js dan keladi — avval o'shalarni ishga tushiring.
//
// IDEMPOTENT: shu nomli guruh bor bo'lsa qayta qo'shilmaydi.
//
// Ishga tushirish: node scripts/seed-test-groups.js
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

// `name` — referensdagi kabi guruh RAQAMI (tanlov ro'yxatida shu ko'rinadi).
const GROUPS = [
  {
    name: "101",
    course: "Ingliz tili",
    level: "1-bosqich",
    eduType: "Offline",
    day: "Toq kunlar",
    time: "09:00-10:30",
    teacher: "Otabek Rasulov",
    room: "",
    // scripts/seed-test-pupils.js dagi o'quvchilar (ism bo'yicha topiladi)
    students: ["Ozodbek Nazarov", "Malika Yusupova", "Sardor Qodirov", "Nilufar Rahimova"],
  },
  {
    name: "102",
    course: "Matematika",
    level: "2-bosqich",
    eduType: "Offline",
    day: "Juft kunlar",
    time: "14:00-15:30",
    teacher: "Dilnoza Karimova",
    room: "",
    students: ["Zilola Ismoilova", "Bekzod Ergashev", "Doniyor Mirzayev"],
  },
];

(async () => {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI topilmadi (.env.local)");
  const client = new MongoClient(uri, { maxPoolSize: 5 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "crm_akademiya");
  const col = db.collection("groups");
  await col.createIndex({ id: 1 }, { unique: true });

  const pupils = await db.collection("pupils").find({}).toArray();
  const idOf = (fullName) => {
    const p = pupils.find((x) => `${x.firstName} ${x.lastName}`.trim() === fullName);
    return p ? p.id : null;
  };

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  let nextId = (last[0]?.id ?? 0) + 1;

  let added = 0;
  let skipped = 0;
  for (const g of GROUPS) {
    const exists = await col.findOne({ name: g.name });
    if (exists) {
      skipped++;
      console.log(`- o'tkazib yuborildi (bor): ${g.name} (id ${exists.id})`);
      continue;
    }
    const studentIds = g.students.map(idOf).filter((v) => v !== null);
    if (studentIds.length !== g.students.length) {
      console.log(`  ! ogohlantirish: ${g.name} — ba'zi o'quvchilar topilmadi (seed-test-pupils.js ishga tushganmi?)`);
    }
    await col.insertOne({
      id: nextId,
      name: g.name,
      course: g.course,
      level: g.level,
      eduType: g.eduType,
      day: g.day,
      time: g.time,
      period: "",
      periodExpired: false,
      students: studentIds.length,
      teacher: g.teacher,
      room: g.room,
      telegram: null,
      status: "active",
      highlighted: false,
      startDate: "",
      endDate: "",
      studentIds,
    });
    console.log(`+ qo'shildi: ${g.name} (id ${nextId}, ${g.course}, ${g.teacher}, ${studentIds.length} o'quvchi)`);
    nextId++;
    added++;
  }

  console.log(`\nQo'shildi: ${added}, o'tkazib yuborildi: ${skipped}. Bazadagi jami guruhlar: ${await col.countDocuments()}`);
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
