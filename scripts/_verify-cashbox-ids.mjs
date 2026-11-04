// KASSA O'CHIRISH VA KASSA ID SI — haqiqiy route'lar, haqiqiy MongoDB.
//
//   node --experimental-transform-types --no-warnings --import ./scripts/_ts-alias.mjs scripts/_verify-cashbox-ids.mjs
//
// `MONGODB_URI` dagi serverda `tmp_kassa_<tasodifiy>` bazasini ochadi va oxirida
// o'chiradi. Ish bazasiga TEGMAYDI: @/lib/mongodb shu bazani qaytaradigan
// stub'ga almashtirilgan, ya'ni route'lar boshqa bazani ko'rmaydi ham.
// Sessiya va filial ham stub (getCurrentEmployee, getBranchScope).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { MongoClient } from "mongodb";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
  }
}
if (!process.env.MONGODB_URI) {
  console.log("MONGODB_URI yo'q — sinov ishlamaydi.");
  process.exit(1);
}

const ROOT = new URL("../", import.meta.url).href;
const data = (code) => "data:text/javascript," + encodeURIComponent(code);
const STUBS = {
  "@/lib/mongodb": data("export async function ensureIndexes() { return globalThis.__db; } export async function getDb() { return globalThis.__db; }"),
  "@/lib/currentEmployee": data(`export * from "${ROOT}lib/currentEmployee.ts"; export async function getCurrentEmployee() { return globalThis.__me ?? null; }`),
  "@/lib/branchScope": data(`export * from "${ROOT}lib/branchScope.ts"; export async function getBranchScope() { return null; }`),
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const DB_NAME = `tmp_kassa_${randomBytes(3).toString("hex")}`;
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(DB_NAME);
globalThis.__db = db;
await db.collection("cashboxes").createIndex({ id: 1 }, { unique: true }); // prod'dagi kabi

// KASSA_ESKI_KOD=1 — sinovning o'zini tekshirish: tuzatishdan oldingi route nusxalari
// bilan yurganda xato TOPILISHI kerak.
const OLD = process.env.KASSA_ESKI_KOD === "1";
const { POST } = await import(OLD ? "./_tmp-old-cashboxes-route.ts" : "@/app/api/cashboxes/route");
const { DELETE } = await import(OLD ? "./_tmp-old-cashbox-id-route.ts" : "@/app/api/cashboxes/[id]/route");
const { HISTORY_BLOCKS_DELETE } = await import("@/lib/cashboxLifecycle");

const admin = { isAdmin: true, name: "Sinov Admin" };
const kassir = { isAdmin: false, name: "Sinov Kassir" };
const answer = async (res) => ({ status: res.status, body: await res.json() });
const create = (name, me = admin) => {
  globalThis.__me = me;
  return POST(new Request("http://sinov/api/cashboxes", { method: "POST", body: JSON.stringify({ name }) })).then(answer);
};
const remove = (id, me = admin) => {
  globalThis.__me = me;
  return DELETE(new Request(`http://sinov/api/cashboxes/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id: String(id) }) }).then(answer);
};
const box = (id) => db.collection("cashboxes").findOne({ id });
const reset = () => Promise.all(["cashboxes", "counters", "transaction_entries", "transactions", "salary_runs", "bonuses", "penalties"].map((n) => db.collection(n).deleteMany({})));

let bad = 0;
async function check(name, fn) {
  await reset();
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    bad++;
    console.log(`✗ ${name}\n    ${String(e.message).split("\n")[0]}`);
  }
}

try {
  await check("bo'sh bazada birinchi kassa id 1", async () => {
    assert.equal((await create("Birinchi")).body.cashbox.id, 1);
  });

  await check("03.11 hodisasi: bekor qilingan to'lovi bor kassa o'chmaydi, jurnal yetim qolmaydi", async () => {
    await create("Rahbar kassa");
    await db.collection("transaction_entries").insertOne({ id: 4, cashboxId: 1, amount: 100, txType: "payIn", status: "cancelled" });
    const r = await remove(1);
    assert.equal(r.status, 409);
    assert.equal(r.body.error, HISTORY_BLOCKS_DELETE);
    assert.ok(await box(1), "kassa joyida qolishi kerak");
  });

  for (const collection of ["transaction_entries", "transactions", "salary_runs", "bonuses", "penalties"]) {
    await check(`${collection} dagi yozuv kassani o'chirishni to'sadi`, async () => {
      await create("Kassa");
      await db.collection(collection).insertOne({ id: 1, cashboxId: 1 });
      assert.equal((await remove(1)).status, 409);
    });
  }

  await check("tarixsiz kassa o'chadi, boshqa kassaning yozuvi xalaqit bermaydi", async () => {
    await create("Birinchi");
    await create("Ikkinchi");
    await db.collection("transaction_entries").insertOne({ id: 1, cashboxId: 1 });
    assert.equal((await remove(2)).status, 200);
    assert.equal(await box(2), null);
  });

  await check("o'chirilgan kassa raqami yangi kassaga berilmaydi", async () => {
    await create("Birinchi");
    assert.equal((await remove(1)).status, 200);
    assert.equal((await create("Yangi")).body.cashbox.id, 2);
  });

  await check("hisoblagichsiz bazada ham o'chirilgan raqam qaytmaydi", async () => {
    await db.collection("cashboxes").insertOne({ id: 20, name: "Eski kassa", balance: 0, methodTotals: {} });
    assert.equal((await remove(20)).status, 200);
    assert.equal((await create("Yangi")).body.cashbox.id, 21);
  });

  await check("deploydan oldin yetim qolgan to'lovlar yangi kassaga yopishmaydi", async () => {
    await db.collection("transaction_entries").insertOne({ id: 1, cashboxId: 7, amount: 500, txType: "payIn", status: "" });
    await db.collection("transactions").insertOne({ id: 1, cashboxId: 9, amount: 500 });
    const { id } = (await create("Yangi")).body.cashbox;
    assert.equal(id, 10);
    assert.equal(await db.collection("transaction_entries").countDocuments({ cashboxId: id }), 0);
  });

  await check("hozirgi Temuriylar holati: kassa #1, jurnal bo'sh, hisoblagich yo'q → keyingisi 2", async () => {
    await db.collection("cashboxes").insertOne({ id: 1, name: "Muhsinjon rahbar kassa", balance: 0, methodTotals: {} });
    assert.equal((await create("Ikkinchi")).body.cashbox.id, 2);
  });

  await check("cashboxId bo'sh yoki matn bo'lgan yozuvlar id hisobini buzmaydi", async () => {
    await db.collection("bonuses").insertOne({ id: 1, cashboxId: null });
    await db.collection("penalties").insertOne({ id: 1, cashboxId: "yetti" });
    assert.equal((await create("Birinchi")).body.cashbox.id, 1);
  });

  await check("bir vaqtdagi 5 ta so'rov 5 xil id oladi", async () => {
    const all = await Promise.all([1, 2, 3, 4, 5].map((n) => create(`Kassa ${n}`)));
    assert.deepEqual(all.map((r) => r.body.cashbox?.id).sort(), [1, 2, 3, 4, 5]);
  });

  await check("yo'q kassa 404, hisoblagich ko'tarilmaydi", async () => {
    await create("Birinchi");
    assert.equal((await remove(9999)).status, 404);
    assert.equal((await create("Ikkinchi")).body.cashbox.id, 2);
  });

  await check("admin bo'lmagan xodim kassa yaratolmaydi va o'chirolmaydi", async () => {
    await create("Birinchi");
    assert.equal((await create("Begona", kassir)).status, 403);
    assert.equal((await remove(1, kassir)).status, 403);
    assert.ok(await box(1));
  });
} finally {
  assert.ok(db.databaseName.startsWith("tmp_kassa_"));
  await db.dropDatabase();
  const left = await client.db("admin").admin().listDatabases({ nameOnly: true }).then((r) => r.databases.some((d) => d.name === DB_NAME)).catch(() => "tekshirilmadi");
  await client.close();
  console.log(`\nVaqtinchalik baza o'chirildi (qolganmi: ${left}).`);
}
console.log(bad ? `${bad} ta sinov o'tmadi.` : "Hammasi to'g'ri.");
process.exit(bad ? 1 : 0);
