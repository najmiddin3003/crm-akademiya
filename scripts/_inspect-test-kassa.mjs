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

const cashboxes = await db.collection("cashboxes").find({ name: /test kassa/i }).toArray();
console.log("CASHBOXES:", JSON.stringify(cashboxes, null, 2));

for (const cb of cashboxes) {
  const entries = await db.collection("transaction_entries").find({ cashboxId: cb.id }).toArray();
  console.log(`\nENTRIES for cashboxId=${cb.id}:`, JSON.stringify(entries.map(({_id, ...r}) => r), null, 2));
}

await client.close();
