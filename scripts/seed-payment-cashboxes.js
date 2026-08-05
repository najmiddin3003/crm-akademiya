// Bir martalik skript: to'lov turi bo'yicha umumiy "kassalar"ni (Plastik
// karta / Click-Payme / Bank hisobi) mavjud cashboxes kolleksiyasiga qo'shadi.
// `cashboxes` kolleksiyasi allaqachon 4 ta yozuv bilan to'lgan bo'lsa,
// /api/cashboxes'dagi "bo'sh bo'lsa seed qil" mantig'i ishlamaydi — shu
// sabab bu yozuvlar alohida, idempotent (id bo'yicha upsert) qo'shiladi.
// Ishga tushirish: node scripts/seed-payment-cashboxes.js
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
    if (!(key in process.env)) process.env[key] = value;
  }
}

function zero() {
  return { naqd: 0, plastik: 0, inkassa: 0, terminal: 0, korporativKarta: 0, ilovaClick: 0, yagonaQr: 0, hisobRaqam: 0 };
}

const NEW_CASHBOXES = [
  {
    id: 5,
    name: "Plastik karta",
    balance: 950000,
    moderator: "",
    onlinePayment: false,
    archived: false,
    isPrimary: false,
    methodTotals: { ...zero(), plastik: 950000 },
  },
  {
    id: 6,
    name: "Click / Payme",
    balance: 900000,
    moderator: "",
    onlinePayment: false,
    archived: false,
    isPrimary: false,
    methodTotals: { ...zero(), ilovaClick: 900000 },
  },
  {
    id: 7,
    name: "Bank hisobi",
    balance: 14953000,
    moderator: "",
    onlinePayment: false,
    archived: false,
    isPrimary: false,
    methodTotals: { ...zero(), hisobRaqam: 14953000 },
  },
];

async function main() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "crm_akademiya";
  if (!uri) throw new Error("MONGODB_URI .env.local da topilmadi");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const col = db.collection("cashboxes");
    for (const cashbox of NEW_CASHBOXES) {
      await col.updateOne({ id: cashbox.id }, { $set: cashbox }, { upsert: true });
      console.log(`OK: #${cashbox.id} ${cashbox.name}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
