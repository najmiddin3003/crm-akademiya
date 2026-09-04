// Bildirishnomalar route'ining SO'ROVLARINI baza ustida aynan takrorlaydi
// (app/api/notifications/route.ts). Tekshiruv uchun; ilovaga kirmaydi.
import fs from "fs";
import { MongoClient, ObjectId } from "mongodb";

const env = fs.readFileSync(".env.local", "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");

const WINDOW_DAYS = 7;
const SOURCE_SCAN = 100;
const SOURCE_SHOW = 8;

const p2 = (n) => String(n).padStart(2, "0");
const toUz = (d) => new Date(d.getTime() + (d.getTimezoneOffset() + 300) * 60000);
const uzDateIso = (d) => { const u = toUz(d); return `${u.getFullYear()}-${p2(u.getMonth() + 1)}-${p2(u.getDate())}`; };
const uzWall = (d) => { const u = toUz(d); return `${u.getFullYear()}-${p2(u.getMonth() + 1)}-${p2(u.getDate())}T${p2(u.getHours())}:${p2(u.getMinutes())}:00`; };
const uzStamp = (d) => { const u = toUz(d); return `${p2(u.getDate())}.${p2(u.getMonth() + 1)}.${u.getFullYear()} | ${p2(u.getHours())}:${p2(u.getMinutes())}`; };
const uzMoney = (n) => Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/[ ,]/g, " ");
const overdueUz = (m) => (m < 60 ? `${m} daqiqa kechikdi` : m < 1440 ? `${Math.floor(m / 60)} soat kechikdi` : `${Math.floor(m / 1440)} kun kechikdi`);
function uzParseStamp(s) {
  if (typeof s !== "string") return null;
  const t = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? Date.parse(s)
    : /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T00:00:00+05:00`)
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? Date.parse(`${s}:00+05:00`)
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s) ? Date.parse(`${s}+05:00`)
    : NaN;
  return Number.isFinite(t) ? t : null;
}

const c = new MongoClient(get("MONGODB_URI"), { maxPoolSize: 5 }); // zip.md qoidasi: skriptlar 5 dan oshmasin
await c.connect();
const db = c.db(get("MONGODB_DB") || "crm_akademiya");

const now = new Date();
const nowMs = now.getTime();
const sinceMs = nowMs - WINDOW_DAYS * 86400000;
const sinceIso = new Date(sinceMs).toISOString();

// Har bir foydalanuvchi uchun alohida: kim nimani ko'radi.
const users = await db.collection("users").find({}, { projection: { fullName: 1, role: 1, hrEmployeeId: 1, lastSeenNotifAt: 1 } }).toArray();
const roles = await db.collection("roles").find({}).toArray();
const roleOf = (r) => roles.find((x) => String(x.key ?? x.name ?? "").toLowerCase() === String(r).toLowerCase());

for (const u of users) {
  const role = roleOf(u.role);
  const perms = Array.isArray(role?.permissions) ? role.permissions : null;
  const allowed = (p) => perms === null || perms.includes(p);
  const isAdmin = u.role === "admin";
  const canPayAll = allowed("/finance-transactions");
  const canPayOwn = allowed("/finance-cash");
  const canOrder = allowed("/orders-list");
  const canTask = allowed("/tasks");

  console.log(`\n=== ${u.fullName} (${u.role}) — pay:${canPayAll || canPayOwn} order:${canOrder} task:${canTask}`);

  const items = [];
  const sources = {};

  // --- to'lovlar ---
  if (canPayAll || canPayOwn) {
    let boxFilter = {};
    let state = "on";
    if (!isAdmin && !canPayAll) {
      const emp = u.hrEmployeeId == null ? null : await db.collection("hr_employees").findOne({ id: u.hrEmployeeId }, { projection: { name: 1 } });
      const name = String(emp?.name ?? "").trim();
      if (!name) state = "no-cashbox";
      else boxFilter = { moderator: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } };
    }
    if (state === "on") {
      // withBranch(filter, {branchId:1}) — 1-filial maydonsizlarni ham oladi
      const scoped = { $and: [boxFilter, { $or: [{ branchId: 1 }, { branchId: { $exists: false } }, { branchId: null }] }] };
      const boxes = await db.collection("cashboxes").find(scoped, { projection: { id: 1, _id: 0 } }).toArray();
      const boxIds = boxes.map((b) => Number(b.id)).filter(Number.isFinite);
      if (boxIds.length === 0) state = "no-cashbox";
      else {
        const rows = await db.collection("transaction_entries").find({
          txType: "payIn", status: { $ne: "cancelled" }, cashboxId: { $in: boxIds },
          createdAt: { $gte: sinceIso }, date: { $gte: uzDateIso(new Date(sinceMs)) },
        }, { projection: { _id: 0, id: 1, studentName: 1, txName: 1, amount: 1, paymentType: 1, createdAt: 1 } })
          .sort({ createdAt: -1 }).limit(SOURCE_SCAN).toArray();
        for (const r of rows) {
          const student = String(r.studentName ?? "").trim();
          const suffix = r.paymentType ? ` (${r.paymentType})` : "";
          items.push({ kind: "payment", at: r.createdAt,
            title: student ? "Yangi to'lov" : "Yangi kirim",
            body: student ? `${student} — ${uzMoney(r.amount)} UZS${suffix}` : `${String(r.txName ?? "").trim() || "Kirim"} — ${uzMoney(r.amount)} UZS${suffix}`,
            meta: null });
        }
        sources.payment = { state, n: rows.length };
      }
    }
    if (state !== "on") sources.payment = { state, n: 0 };
  } else sources.payment = { state: "off", n: 0 };

  // --- buyurtmalar ---
  if (canOrder) {
    const minId = ObjectId.createFromTime(Math.floor(sinceMs / 1000));
    const rows = await db.collection("orders").find({ _id: { $gte: minId } },
      { projection: { _id: 1, id: 1, name: 1, course: 1, phone: 1 } }).sort({ _id: -1 }).limit(SOURCE_SCAN).toArray();
    for (const r of rows) items.push({ kind: "order", at: r._id.getTimestamp().toISOString(),
      title: "Yangi buyurtma", body: [r.name, r.course, r.phone].map((v) => String(v ?? "").trim()).filter(Boolean).join(" — "), meta: null });
    sources.order = { state: "on", n: rows.length };
  } else sources.order = { state: "off", n: 0 };

  // --- kechikkan topshiriqlar ---
  if (canTask) {
    const st = { $in: ["yangi", "jarayonda", "kutilmoqda"] };
    const lo = uzWall(new Date(sinceMs - 12 * 3600000));
    const hi = uzWall(new Date(nowMs + 12 * 3600000));
    const proj = { projection: { _id: 1, id: 1, student: 1, staff: 1, description: 1, date: 1 } };
    const [a, b] = await Promise.all([
      db.collection("tasks").find({ state: st, date: { $gte: lo, $lt: hi } }, proj).sort({ date: -1 }).limit(SOURCE_SCAN).toArray(),
      db.collection("tasks").find({ state: st, date: { $gte: lo, $lt: hi } }, proj).sort({ _id: -1 }).limit(SOURCE_SCAN).toArray(),
    ]);
    const seen = new Set(); let n = 0;
    for (const r of [...a, ...b]) {
      if (seen.has(r.id)) continue; seen.add(r.id);
      const dl = uzParseStamp(r.date);
      if (dl === null || dl >= nowMs || dl < sinceMs) continue;
      const at = new Date(Math.max(dl, r._id.getTimestamp().getTime())).toISOString();
      items.push({ kind: "task", at, title: "Kechikkan topshiriq",
        body: `${String(r.student ?? "").trim() || "—"}${r.staff ? ` (${r.staff})` : ""} — ${String(r.description ?? "").trim() || "tavsifsiz"}`,
        meta: `Muddat: ${uzStamp(new Date(dl))} — ${overdueUz(Math.floor((nowMs - dl) / 60000))}` });
      n++;
    }
    sources.task = { state: "on", n };
  } else sources.task = { state: "off", n: 0 };

  console.log("  sources:", JSON.stringify(sources));
  const shown = [];
  for (const k of ["payment", "order", "task"]) {
    shown.push(...items.filter((i) => i.kind === k).sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, SOURCE_SHOW));
  }
  shown.sort((x, y) => (x.at < y.at ? 1 : -1));
  console.log(`  panelda ${shown.length} qator:`);
  for (const i of shown.slice(0, 6)) console.log(`    [${i.kind}] ${i.title} — ${i.body}${i.meta ? " || " + i.meta : ""}`);
}

await c.close();
