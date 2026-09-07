// 4-filial guruhlariga xonalarni QAYTA taqsimlaydi — vaqt KESISHISHINI
// hisobga olib.
//
//   node scripts/_fix-uchqorgon-rooms.mjs          -> quruq yurish
//   node scripts/_fix-uchqorgon-rooms.mjs --apply  -> yozadi
//
// NIMA NOTO'G'RI EDI: birinchi taqsimotda faqat AYNAN bir xil (kun, vaqt)
// juftligi to'qnashuv deb qaralgandi. Aslida "13:00 - 15:00" va
// "14:00 - 15:00" ham bir xonada tura olmaydi — ular kesishadi.
// Oqibati jadvalda ko'rinadi: components/groups/GroupSchedulePage.tsx dagi
// buildMatrices() bir katakka ikkinchi darsni QO'YMAYDI (`if (start[s][c]
// || skip[s][c]) continue`), ya'ni kesishgan darslardan biri jadvalda
// UMUMAN chizilmasdi — xatosiz, jimgina.
//
// Xona taqsimoti baribir FAYLDAN EMAS (Excel'da xona yo'q) — bu faqat
// to'qnashuvsiz joylashtirish; haqiqiy xonalarni foydalanuvchi qo'yadi.
import fs from "node:fs";
import { MongoClient } from "mongodb";

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));

const APPLY = process.argv.includes("--apply");
const BRANCH_ID = 4;

const mins = (hhmm) => {
  const m = String(hhmm).match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
};
const range = (t) => {
  const m = String(t).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  return m ? { from: mins(m[1]), to: mins(m[2]) } : null;
};
const overlaps = (a, b) => a.from < b.to && b.from < a.to;

const groups = await db.collection("groups")
  .find({ branchId: BRANCH_ID }, { projection: { _id: 0, id: 1, name: 1, day: 1, time: 1, room: 1, teacher: 1, course: 1 } })
  .sort({ id: 1 })
  .toArray();

const rooms = (await db.collection("rooms")
  .find({ branchId: BRANCH_ID }, { projection: { _id: 0, name: 1 } })
  .sort({ id: 1 }).toArray()).map((r) => r.name);

// Kun -> xona -> band oraliqlar
const busy = new Map();
const changes = [];
const newRooms = [];
let needed = 0;

// Boshlanish vaqti bo'yicha — ochko'z joylashtirish shu tartibda optimal.
const sorted = [...groups].sort((a, b) => a.day.localeCompare(b.day) || mins(a.time) - mins(b.time));

for (const g of sorted) {
  const r = range(g.time);
  if (!r) { console.log(`  VAQTI YAROQSIZ: ${g.name} "${g.time}"`); continue; }
  const key = g.day;
  if (!busy.has(key)) busy.set(key, new Map());
  const perRoom = busy.get(key);

  let chosen = "";
  for (const room of rooms) {
    const taken = perRoom.get(room) ?? [];
    if (!taken.some((t) => overlaps(t, r))) { chosen = room; break; }
  }
  // XONA YETMASA — yangisi ochiladi. Kesishgan darslar sonini xona soni
  // belgilaydi: "Juft kunlar 15:00-16:00" da 6 ta dars bir vaqtda ketadi,
  // 5 ta xona esa bittasini joysiz qoldirardi va u jadvalda ko'rinmasdi.
  if (!chosen) {
    chosen = `${rooms.length + 1} - xona`;
    rooms.push(chosen);
    newRooms.push(chosen);
    needed++;
  }
  const taken = perRoom.get(chosen) ?? [];
  taken.push(r);
  perRoom.set(chosen, taken);
  if (chosen !== g.room) changes.push({ id: g.id, name: g.name, day: g.day, time: g.time, from: g.room, to: chosen });
}

// Eski holatdagi kesishishlarni sanaymiz — nima tuzalayotgani ko'rinsin.
let before = 0;
const check = new Map();
for (const g of groups) {
  const r = range(g.time);
  if (!r) continue;
  const k = `${g.day}|${g.room}`;
  const list = check.get(k) ?? [];
  if (list.some((t) => overlaps(t.r, r))) {
    before++;
    console.log(`  ESKI KESISHISH: ${g.day} ${g.room} — ${g.name} (${g.time}) <-> ${list.find((t) => overlaps(t.r, r)).name}`);
  }
  list.push({ r, name: g.name });
  check.set(k, list);
}

console.log(`\nGuruh: ${groups.length}   mavjud xona: ${rooms.length - newRooms.length}`);
console.log(`Eski taqsimotdagi kesishish: ${before} ta`);
console.log(`O'zgartiriladigan guruh: ${changes.length} ta   qo'shiladigan xona: ${newRooms.length} ta ${newRooms.join(", ")}`);
for (const c of changes) console.log(`  ${c.name.padEnd(7)} ${c.day.padEnd(12)} ${c.time.padEnd(15)} ${c.from} -> ${c.to}`);

if (!APPLY) {
  console.log(`\nYozish uchun: node scripts/_fix-uchqorgon-rooms.mjs --apply`);
  await client.close();
  process.exit(0);
}

// Yangi xonalar — kvitansiyaga ham yoziladi, `--undo` ularni ham o'chirsin.
const RECEIPT = "scripts/_uchqorgon-import-receipt.json";
if (newRooms.length) {
  let rid = ((await db.collection("rooms").find({}).sort({ id: -1 }).limit(1).toArray())[0]?.id ?? 0) + 1;
  const ids = [];
  for (const nm of newRooms) {
    const doc = { id: rid++, name: nm, capacity: 0, note: "", branchId: BRANCH_ID };
    await db.collection("rooms").insertOne({ ...doc });
    ids.push(doc.id);
  }
  if (fs.existsSync(RECEIPT)) {
    const r = JSON.parse(fs.readFileSync(RECEIPT, "utf8"));
    r.created.rooms.push(...ids);
    fs.writeFileSync(RECEIPT, JSON.stringify(r, null, 2), "utf8");
  }
  console.log(`\n${ids.length} ta yangi xona yaratildi (${newRooms.join(", ")}).`);
}

for (const c of changes) {
  await db.collection("groups").updateOne({ id: c.id, branchId: BRANCH_ID }, { $set: { room: c.to } });
}
console.log(`${changes.length} ta guruhning xonasi yangilandi.`);
await client.close();
