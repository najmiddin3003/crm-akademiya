// Bir martalik: bo'sh bazaga BIRINCHI filialni qo'shadi (yangi markaz, 30.10.2026).
// Filial bor bo'lsa hech narsa qilmaydi — qolganlari Boshqaruv → Filiallar'dan.
//
//   BRANCH_NAME="Markaziy filial" node scripts/seed-branch.mjs
//
// Hujjat shakli app/api/branches/route.ts (POST) dagi bilan bir xil.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const text = fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!(key in process.env)) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

async function main() {
  loadEnvLocal();
  const name = (process.env.BRANCH_NAME || process.env.NEXT_PUBLIC_CENTER_SHORT || "").trim();
  if (!name) throw new Error("Filial nomi bo'sh (BRANCH_NAME)");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI .env.local da yo'q");

  const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2 });
  await client.connect();
  try {
    const col = client.db(process.env.MONGODB_DB || "crm_akademiya").collection("branches");
    const count = await col.countDocuments();
    if (count > 0) {
      console.log(`Filiallar bor (${count} ta) — qo'shilmadi.`);
      return;
    }
    await col.insertOne({ id: 1, name, location: "", address: "", phone: "" });
    console.log(`Filial qo'shildi: #1 «${name}»`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
