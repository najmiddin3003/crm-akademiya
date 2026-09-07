// BITTA TEST O'QUVCHI qo'shadi — "Akademiya 4 Uchqo'rg'on" (branchId: 4).
//
// Hujjat shakli POST /api/pupils bilan AYNAN bir xil
// (lib/pupilsData.ts -> buildPupilFromValues + branchId), ya'ni ilova
// orqali qo'shilganidan farq qilmaydi.
//
//   node scripts/_add-test-pupil-branch4.mjs          -> qo'shadi
//   node scripts/_add-test-pupil-branch4.mjs --undo   -> o'chiradi
//
// O'chirish yozuvni ISM va branchId bo'yicha topadi, ya'ni haqiqiy
// o'quvchiga tegmaydi.
import { MongoClient } from "mongodb";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));
const col = db.collection("pupils");

const BRANCH_ID = 4;
const FIRST = "Sinov";
const LAST = "Uchqo'rg'on";

if (process.argv.includes("--undo")) {
  const res = await col.deleteMany({ branchId: BRANCH_ID, firstName: FIRST, lastName: LAST });
  console.log(`o'chirildi: ${res.deletedCount} ta`);
  await client.close();
  process.exit(0);
}

const exists = await col.findOne({ branchId: BRANCH_ID, firstName: FIRST, lastName: LAST }, { projection: { id: 1 } });
if (exists) {
  console.log(`allaqachon bor: id=${exists.id} — ikkinchi marta qo'shilmadi`);
  await client.close();
  process.exit(0);
}

// `id` GLOBAL ketma-ket (unikal indeks butun kolleksiyada) — filial
// bo'yicha kesilmasdan qidiriladi, aks holda ikkinchi filial mavjud id ni
// qayta ishlatib E11000 ga urilardi (app/api/pupils/route.ts dagi qoida).
const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
const nextId = (last[0]?.id ?? 0) + 1;

// Toshkent vaqti (lib/uzTime.ts bilan bir xil format: "DD.MM.YYYY | HH:mm").
const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
const pad = (n) => String(n).padStart(2, "0");
const createdAt = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} | ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const pupil = {
  firstName: FIRST,
  lastName: LAST,
  phone: "90 000 00 04",
  extraPhone: "",
  category: "",
  birthDate: "",
  source: "Tavsiya",
  id: nextId,
  createdAt,
  balance: 0,
  coin: 0,
  moderator: "",
  status: "Aktiv",
  branchId: BRANCH_ID,
};

await col.insertOne({ ...pupil });
console.log(`qo'shildi: id=${nextId}  ${FIRST} ${LAST}  branchId=${BRANCH_ID}  ${createdAt}`);

await client.close();
