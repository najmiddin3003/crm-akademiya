// FAQAT O'QISH emas — indekslar mavjud bo'lsa qayta yaratmaydi, lekin
// har biri baribir server bilan bitta round-trip qiladi. Maqsad: sovuq
// startdagi `ensureIndexes()` narxini O'LCHASH.
import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const t0 = Date.now();
const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const tConnect = Date.now() - t0;
const db = client.db(env.MONGODB_DB || undefined);

// Bitta yengil so'rov — "baza tayyor" nuqtasi
const t1 = Date.now();
await db.command({ ping: 1 });
const tPing = Date.now() - t1;

// ensureIndexes bilan bir xil shakl: 71 ta createIndex, parallel
const t2 = Date.now();
const cols = await db.listCollections({}, { nameOnly: true }).toArray();
const tasks = [];
for (const { name } of cols) tasks.push(db.collection(name).createIndex({ id: 1 }).catch(() => {}));
await Promise.all(tasks);
const tIdx = Date.now() - t2;

console.log(`ulanish:            ${tConnect} ms`);
console.log(`ping:               ${tPing} ms`);
console.log(`${String(tasks.length).padStart(2)} ta createIndex (parallel): ${tIdx} ms`);
await client.close();
