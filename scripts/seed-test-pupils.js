// Bir martalik skript: MongoDB `pupils` kolleksiyasiga 10 ta test o'quvchi
// qo'shadi. Ilgari o'quvchilar ro'yxati statik demo massivlardan kelardi
// (constants/index.js → STUDENTS, constants/studentsList.js → STUDENTS_LIST);
// ular olib tashlandi va endi butun ilova /api/pupils dan o'qiydi — shu bois
// bazada ko'rish/tanlash uchun haqiqiy yozuvlar kerak.
//
// IDEMPOTENT: ism+familiya bo'yicha allaqachon bor o'quvchi qayta
// qo'shilmaydi, mavjud yozuvlar o'zgartirilmaydi.
//
// Ishga tushirish: node scripts/seed-test-pupils.js
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

// Telefon — ilovaning boshqa joylaridagi kabi bo'sh joy bilan ajratilgan
// mahalliy format ("94 408 57 97"), kategoriya — constants/index.js dagi
// STUDENT_CATEGORIES qiymatlari, moderator — bazadagi haqiqiy xodimlar.
const PUPILS = [
  { firstName: "Ozodbek",  lastName: "Nazarov",     phone: "93 214 55 07", extraPhone: "94 300 55 07", category: "Katta (10-sinf+)",  birthDate: "2008-03-14", createdAt: "12.02.2026 | 10:24", balance:  450000, coin: 12, moderator: "Dilmurod Komilov",  source: "Instagram" },
  { firstName: "Malika",   lastName: "Yusupova",    phone: "94 331 09 42", extraPhone: "",             category: "O'rta (5-9-sinf)",   birthDate: "2012-07-02", createdAt: "27.02.2026 | 15:08", balance:  300000, coin:  8, moderator: "Nilufar Sharipova", source: "Telegram" },
  { firstName: "Sardor",   lastName: "Qodirov",     phone: "90 187 63 25", extraPhone: "",             category: "Katta (10-sinf+)",  birthDate: "2007-11-19", createdAt: "05.03.2026 | 09:41", balance: -250000, coin:  0, moderator: "Dilmurod Komilov",  source: "Tavsiya" },
  { firstName: "Nilufar",  lastName: "Rahimova",    phone: "97 402 18 76", extraPhone: "91 220 18 76", category: "O'rta (5-9-sinf)",   birthDate: "2011-01-26", createdAt: "18.03.2026 | 12:55", balance:  270000, coin: 25, moderator: "Nilufar Sharipova", source: "Instagram" },
  { firstName: "Jasurbek", lastName: "Toshmatov",   phone: "99 556 74 31", extraPhone: "",             category: "Kichik (1-4-sinf)", birthDate: "2016-05-30", createdAt: "02.04.2026 | 17:12", balance:       0, coin:  0, moderator: "Dilmurod Komilov",  source: "" },
  { firstName: "Zilola",   lastName: "Ismoilova",   phone: "91 273 40 68", extraPhone: "",             category: "O'rta (5-9-sinf)",   birthDate: "2013-09-08", createdAt: "21.04.2026 | 11:37", balance:  500000, coin: 40, moderator: "Nilufar Sharipova", source: "Facebook" },
  { firstName: "Bekzod",   lastName: "Ergashev",    phone: "95 618 92 14", extraPhone: "",             category: "Katta (10-sinf+)",  birthDate: "2009-12-04", createdAt: "07.05.2026 | 14:03", balance: -180000, coin:  5, moderator: "Dilmurod Komilov",  source: "Telegram" },
  { firstName: "Sevinch",  lastName: "Abdullayeva", phone: "88 145 37 59", extraPhone: "93 610 37 59", category: "Kichik (1-4-sinf)", birthDate: "2017-02-21", createdAt: "23.05.2026 | 16:46", balance:  230000, coin: 16, moderator: "Nilufar Sharipova", source: "Tavsiya" },
  { firstName: "Doniyor",  lastName: "Mirzayev",    phone: "98 730 26 83", extraPhone: "",             category: "O'rta (5-9-sinf)",   birthDate: "2012-10-11", createdAt: "09.06.2026 | 08:59", balance:       0, coin:  0, moderator: "Dilmurod Komilov",  source: "Instagram" },
  { firstName: "Gulnoza",  lastName: "Sattorova",   phone: "90 469 51 20", extraPhone: "",             category: "Katta (10-sinf+)",  birthDate: "2008-08-17", createdAt: "30.06.2026 | 13:28", balance:  350000, coin: 30, moderator: "Nilufar Sharipova", source: "" },
];

(async () => {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI topilmadi (.env.local)");
  const client = new MongoClient(uri, { maxPoolSize: 5 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "crm_akademiya");
  const col = db.collection("pupils");
  await col.createIndex({ id: 1 }, { unique: true });

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  let nextId = (last[0]?.id ?? 0) + 1;

  let added = 0;
  let skipped = 0;
  for (const p of PUPILS) {
    const exists = await col.findOne({ firstName: p.firstName, lastName: p.lastName });
    if (exists) {
      skipped++;
      console.log(`- o'tkazib yuborildi (bor): ${p.firstName} ${p.lastName} (id ${exists.id})`);
      continue;
    }
    await col.insertOne({ id: nextId, ...p });
    console.log(`+ qo'shildi: ${p.firstName} ${p.lastName} (id ${nextId})`);
    nextId++;
    added++;
  }

  const total = await col.countDocuments();
  console.log(`\nQo'shildi: ${added}, o'tkazib yuborildi: ${skipped}. Bazadagi jami o'quvchilar: ${total}`);
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
