// Bir martalik skript: admin hisobini `users` kolleksiyasiga qo'shadi/yangilaydi.
//
// Ishga tushirish:
//   node scripts/seed-admin.js                       -> 94 155 88 55 / admin1234
//   node scripts/seed-admin.js "90 123 45 67" parol123 "Ism Familiya"
//
// Hisob darhol "active" bo'ladi — SMS bilan faollashtirish (invite) oqimi
// kerak emas, chunki bu birinchi admin.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

const DEFAULT_PHONE = "94 155 88 55";
const DEFAULT_PASSWORD = "admin1234";

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
    if (!(key in process.env)) process.env[key] = value;
  }
}

/** lib/eskiz.ts dagi normalizePhone bilan bir xil: "94 155 88 55" -> "998941558855". */
function normalizePhone(input) {
  const d = String(input).replace(/\D/g, "");
  if (d.length === 9) return "998" + d;
  if (d.length === 12 && d.startsWith("998")) return d;
  if (d.length === 13 && d.startsWith("998")) return d.slice(0, 12);
  return d;
}

/** lib/crypto.ts dagi encryptSecret bilan bir xil — admin panelida parolni ko'rsatish uchun. */
function encryptSecret(value) {
  const key = crypto
    .createHash("sha256")
    .update(process.env.ENCRYPTION_KEY || "dev-insecure-encryption-key-change-me")
    .digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), enc.toString("base64"), cipher.getAuthTag().toString("base64")].join(".");
}

async function main() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "crm_akademiya";
  if (!uri) throw new Error("MONGODB_URI .env.local da topilmadi");

  const phone = normalizePhone(process.argv[2] || DEFAULT_PHONE);
  const password = process.argv[3] || DEFAULT_PASSWORD;
  if (!/^998\d{9}$/.test(phone)) throw new Error(`Telefon raqami noto'g'ri: ${process.argv[2]}`);
  if (password.length < 8) throw new Error("Parol kamida 8 ta belgidan iborat bo'lishi kerak");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    // Login oqimi shu indeksga tayanadi (lib/mongodb.ts dagi ensureIndexes bilan bir xil).
    await db.collection("users").createIndex({ phone: 1 }, { unique: true });

    // Boshqaruv > Xodimlar ro'yxatida shu raqamli xodim bo'lsa — ism/id'ni
    // o'shandan olamiz, shunda profil sahifasi bilan mos tushadi.
    // Kolleksiyada raqam "94 155 88 55" ko'rinishida saqlanadi, `users` da esa
    // normallashtirilgan holda — shu bois solishtirishni JS tarafida qilamiz.
    const roster = await db.collection("hr_employees").find({}, { projection: { id: 1, name: 1, phone: 1 } }).toArray();
    const hr = roster.find((e) => typeof e.phone === "string" && normalizePhone(e.phone) === phone) || null;
    const fullName = process.argv[4] || hr?.name || "Admin";

    const now = new Date();
    const res = await db.collection("users").updateOne(
      { phone },
      {
        $set: {
          phone,
          fullName,
          role: "admin",
          status: "active",
          passwordHash: await bcrypt.hash(password, 10),
          passwordEnc: encryptSecret(password),
          activatedAt: now,
          ...(hr ? { hrEmployeeId: hr.id } : {}),
        },
        $setOnInsert: { createdAt: now },
        $unset: { invite: "" }, // taklif tokeni bo'lsa — endi kerak emas
      },
      { upsert: true },
    );

    const action = res.upsertedCount ? "yaratildi" : "yangilandi";
    console.log(`Admin hisobi ${action}: +${phone} / ${password}  (${fullName}, role: admin)`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
