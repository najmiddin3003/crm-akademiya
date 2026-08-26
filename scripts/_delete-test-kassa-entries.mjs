import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const client = new MongoClient(env.MONGODB_URI);
await client.connect();
const db = client.db(env.MONGODB_DB || "crm_akademiya");

const delResult = await db.collection("transaction_entries").deleteMany({ cashboxId: 1 });
console.log("Deleted transaction_entries:", delResult.deletedCount);

const zeroTotals = {
  naqd: 0,
  plastik: 0,
  terminal: 0,
  ilovaClick: 0,
  inkassa: 0,
  korporativKarta: 0,
  yagonaQr: 0,
  hisobRaqam: 0,
  testTolovTuri: 0,
};

const updResult = await db.collection("cashboxes").updateOne(
  { id: 1 },
  { $set: { balance: 0, methodTotals: zeroTotals } }
);
console.log("Cashbox updated:", updResult.modifiedCount);

await client.close();
