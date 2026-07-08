// Bir martalik skript: admin hisobini users kolleksiyasiga qo'shadi/yangilaydi.
// Ishga tushirish: node scripts/seed-admin.js
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

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

async function main() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "crm_akademiya";
  if (!uri) throw new Error("MONGODB_URI .env.local da topilmadi");

  const phone = "998941558855";
  const password = "admin1234";
  const passwordHash = await bcrypt.hash(password, 10);

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    await db.collection("users").updateOne(
      { phone },
      {
        $set: {
          phone,
          fullName: "Admin",
          role: "admin",
          status: "active",
          passwordHash,
          activatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    console.log(`Admin hisobi tayyor: +${phone} / ${password}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
