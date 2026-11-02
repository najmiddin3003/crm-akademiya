// LAVOZIM → HISOB ROLI sinovi (02.11.2026): lib/employeeRoleSync.ts va uni chaqiradigan
// PATCH /api/hr-employees/:id, PATCH /api/temp-staff/:id, POST /api/hr-employees.
//
// Haqiqiy bazaga ham, tarmoqqa ham CHIQMAYDI: baza — xotiradagi soxta (Mongo filtrlarining
// shu yo'llarga kerakli qismi), sessiya va filial qamrovi — globalThis orqali.
//
//   node --experimental-transform-types --no-warnings scripts/_verify-lavozim-role.mjs
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ObjectId } from "mongodb";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_URL = pathToFileURL(ROOT).href + "/";
const fileUrl = (rel) => new URL(rel, ROOT_URL).href;

// ── Modul almashtirish: haqiqiy fayl URL'i + "?mock" → quyidagi manba ─────────
const real = (rel) => JSON.stringify(fileUrl(rel) + "?real");
const MOCKS = {
  [fileUrl("node_modules/next/server.js")]: `
    export const NextResponse = { json: (body, init) => ({ status: init?.status ?? 200, body }) };
    export function after() {}`,
  [fileUrl("node_modules/next/headers.js")]: `
    export async function cookies() { throw new Error("sinovda cookie yo'q"); }
    export async function headers() { throw new Error("sinovda sarlavha yo'q"); }`,
  [fileUrl("lib/auth.ts")]: `export * from ${real("lib/auth.ts")};
    export async function getCurrentUser() { return globalThis.__me ?? null; }`,
  [fileUrl("lib/mongodb.ts")]: `export * from ${real("lib/mongodb.ts")};
    export async function ensureIndexes() { return globalThis.__db; }
    export async function getDb() { return globalThis.__db; }`,
  [fileUrl("lib/branchScope.ts")]: `export * from ${real("lib/branchScope.ts")};
    export async function getBranchScope() { return globalThis.__scope ?? null; }`,
};
const EXTS = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"];
function withExt(url) {
  const p = fileURLToPath(url);
  if (existsSync(p) && statSync(p).isFile()) return url;
  for (const ext of EXTS) if (existsSync(p + ext)) return url + ext;
  return url;
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    let url = null;
    if (specifier === "next/server" || specifier === "next/headers") url = fileUrl(`node_modules/${specifier}.js`);
    else if (specifier.startsWith("@/")) url = withExt(new URL(specifier.slice(2), ROOT_URL).href);
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      url = withExt(new URL(specifier, context.parentURL).href);
    }
    if (url === null) return nextResolve(specifier, context);
    if (MOCKS[url]) return { url: url + "?mock", shortCircuit: true };
    return nextResolve(url, context);
  },
  load(url, context, nextLoad) {
    const i = url.indexOf("?mock");
    if (i !== -1) return { format: "module", source: MOCKS[url.slice(0, i)], shortCircuit: true };
    return nextLoad(url, context);
  },
});

// ── Soxta baza ───────────────────────────────────────────────────────────────
const hex = (v) => (v && typeof v === "object" && typeof v.toHexString === "function" ? v.toHexString() : v);
const same = (a, b) => hex(a) === hex(b);
const isOps = (c) => c && typeof c === "object" && !Array.isArray(c) && typeof c.toHexString !== "function" && Object.keys(c).some((k) => k.startsWith("$"));
function test(val, cond) {
  if (isOps(cond)) {
    return Object.entries(cond).every(([op, arg]) => {
      if (op === "$in") return arg.some((x) => test(val, x));
      if (op === "$nin") return !arg.some((x) => test(val, x));
      if (op === "$ne") return !test(val, arg);
      if (op === "$exists") return (val !== undefined) === Boolean(arg);
      if (op === "$regex") return typeof val === "string" && new RegExp(arg, cond.$options ?? "").test(val);
      if (op === "$options") return true;
      throw new Error(`soxta baza: ${op} yo'q`);
    });
  }
  if (cond === null) return val === null || val === undefined;
  if (Array.isArray(val)) return val.some((v) => same(v, cond));
  return same(val, cond);
}
function matches(doc, filter) {
  return Object.entries(filter ?? {}).every(([k, cond]) => {
    if (k === "$and") return cond.every((f) => matches(doc, f));
    if (k === "$or") return cond.some((f) => matches(doc, f));
    return test(k.split(".").reduce((v, p) => v?.[p], doc), cond);
  });
}
function applyUpdate(doc, u) {
  for (const [k, v] of Object.entries(u.$set ?? {})) doc[k] = v;
  for (const k of Object.keys(u.$unset ?? {})) delete doc[k];
}
function fakeDb(data) {
  return {
    collection(name) {
      const rows = (data[name] ??= []);
      const cursor = (list) => {
        const c = {
          project: () => c,
          sort: (spec) => {
            const [[k, dir]] = Object.entries(spec);
            list.sort((a, b) => (a[k] > b[k] ? dir : a[k] < b[k] ? -dir : 0));
            return c;
          },
          limit: (n) => ((list = list.slice(0, n)), c),
          toArray: async () => list.map((d) => ({ ...d })),
        };
        return c;
      };
      return {
        find: (f) => cursor(rows.filter((d) => matches(d, f))),
        findOne: async (f) => {
          const d = rows.find((x) => matches(x, f));
          return d ? { ...d } : null;
        },
        countDocuments: async (f) => rows.filter((d) => matches(d, f)).length,
        insertOne: async (doc) => {
          const d = { _id: new ObjectId(), ...doc };
          rows.push(d);
          return { insertedId: d._id };
        },
        updateOne: async (f, u) => {
          const d = rows.find((x) => matches(x, f));
          if (d) applyUpdate(d, u);
          return { matchedCount: d ? 1 : 0, modifiedCount: d ? 1 : 0 };
        },
        updateMany: async (f, u) => {
          const hit = rows.filter((x) => matches(x, f));
          for (const d of hit) applyUpdate(d, u);
          return { matchedCount: hit.length, modifiedCount: hit.length };
        },
        findOneAndUpdate: async (f, u) => {
          const d = rows.find((x) => matches(x, f));
          if (!d) return null;
          applyUpdate(d, u);
          return { ...d };
        },
      };
    },
  };
}

// ── Ma'lumot: har holat toza nusxadan boshlanadi ─────────────────────────────
const PHONE = { A: "901111111", B: "902222222", M: "903333333", T: "904444444", Q: "905555555", X: "906666666", I: "907777777", L: "908888888" };
function seed() {
  const user = (k, emp, role, extra = {}) => ({
    _id: new ObjectId(), phone: "998" + PHONE[k], ...(emp ? { hrEmployeeId: emp } : {}),
    fullName: `Xodim ${k}`, role, status: "active", ...extra,
  });
  const users = {
    A: user("A", 1, "admin"),
    B: user("B", 2, "admin"),
    M: user("M", 3, "moderator"),
    T: user("T", 4, "teacher"),
    Q: user("Q", 5, "admin", { status: "invited" }), // taklif qilingan — hali kira olmaydi
    X: user("X", 6, "admin", { adminApproval: "pending" }), // admin tasdig'ini kutmoqda
    I: user("I", null, "teacher"), // importdan: hrEmployeeId yo'q, telefon bo'yicha bog'lanadi
    L: user("L", 8, "admin"), // eski nomuvofiqlik: lavozimi moderator, roli admin
  };
  const p = (k) => `${PHONE[k].slice(0, 2)} ${PHONE[k].slice(2, 5)} ${PHONE[k].slice(5, 7)} ${PHONE[k].slice(7)}`;
  const emp = (id, k, turi) => ({ id, name: `Xodim ${k}`, phone: p(k), turi, branchIds: [3], payrollBranchId: 3, archReason: "" });
  const data = {
    users: Object.values(users),
    hr_employees: [
      emp(1, "A", "admin"), emp(2, "B", "admin"), emp(3, "M", "moderator"), emp(4, "T", "teacher"),
      emp(5, "Q", "admin"), emp(6, "X", "admin"), emp(7, "I", "teacher"), emp(8, "L", "moderator"),
    ],
    roles: [{ id: 1, key: "teacher", name: "O'qituvchi" }, { id: 2, key: "moderator", name: "Moderator" }, { id: 9, name: "IT mutaxassisi", permissions: ["/home"] }],
    branches: [{ id: 3, name: "Filial 3" }],
  };
  globalThis.__db = fakeDb(data);
  return { data, users };
}
const meOf = (u) => ({
  id: String(u._id), phone: u.phone, fullName: u.fullName, role: u.role,
  permissions: null, hrEmployeeId: u.hrEmployeeId ?? null, lastSeenNotifAt: null,
});
function actAs(u) {
  globalThis.__me = meOf(u);
  globalThis.__scope = { branchId: 3, allowed: [3], isAdmin: u.role === "admin" };
}
const snap = (data) => JSON.stringify([data.users.map((u) => ({ ...u, _id: hex(u._id) })), data.hr_employees]);
const roleOf = (data, u) => data.users.find((x) => same(x._id, u._id)).role;
const turiOf = (data, id) => data.hr_employees.find((e) => e.id === id).turi;

const hrItem = await import(fileUrl("app/api/hr-employees/[id]/route.ts"));
const hrList = await import(fileUrl("app/api/hr-employees/route.ts"));
const tempItem = await import(fileUrl("app/api/temp-staff/[id]/route.ts"));
const { checkLavozimChange } = await import(fileUrl("lib/employeeRoleSync.ts"));

const req = (method, body) => new Request("http://sinov/api", { method, body: JSON.stringify(body) });
const ctx = (id) => ({ params: Promise.resolve({ id: String(id) }) });
/** Boshqaruv → Xodimlar tahrir oynasi kabi: ism, telefon, lavozim va rol id'si har safar ketadi. */
function editEmployee(data, id, over) {
  const e = data.hr_employees.find((x) => x.id === id);
  return hrItem.PATCH(req("PATCH", { name: e.name, phone: e.phone, turi: e.turi, centerRoleId: null, ...over }), ctx(id));
}
/** /vaqtinchalik tahrir oynasi kabi: ism, telefon, vazifa, pochta. */
function editTemp(data, id, over) {
  const e = data.hr_employees.find((x) => x.id === id);
  return tempItem.PATCH(req("PATCH", { name: e.name, phone: e.phone, turi: e.turi, email: "", ...over }), ctx(id));
}

const results = [];
async function holat(title, fn) {
  try {
    await fn();
    results.push({ ok: true, title });
  } catch (e) {
    results.push({ ok: false, title, why: e instanceof Error ? e.message : String(e) });
  }
}
function expect(cond, why) {
  if (!cond) throw new Error(why);
}
const ERR_ADMIN_ONLY = "Administrator lavozimini faqat administrator berishi yoki olishi mumkin";

await holat("Admin boshqa adminni «Moderator» qiladi — hisob roli ham moderator", async () => {
  const { data, users } = seed();
  actAs(users.A);
  const r = await editEmployee(data, 2, { turi: "moderator" });
  expect(r.status === 200 && r.body.ok, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(turiOf(data, 2) === "moderator", "lavozim yozilmadi");
  expect(roleOf(data, users.B) === "moderator", `hisob roli: ${roleOf(data, users.B)}`);
});

await holat("Admin moderatorni «Administrator» qiladi — admin huquqi beriladi", async () => {
  const { data, users } = seed();
  actAs(users.A);
  const r = await editEmployee(data, 3, { turi: "admin" });
  expect(r.status === 200 && r.body.ok, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(roleOf(data, users.M) === "admin", `hisob roli: ${roleOf(data, users.M)}`);
});

await holat("Admin bo'lmagan xodim o'zini «Administrator» qila olmaydi — 403, hech narsa yozilmaydi", async () => {
  const { data, users } = seed();
  actAs(users.M);
  const before = snap(data);
  const r = await editEmployee(data, 3, { turi: "admin" });
  expect(r.status === 403 && r.body.error === ERR_ADMIN_ONLY, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Admin bo'lmagan xodim adminni moderator qila olmaydi — 403", async () => {
  const { data, users } = seed();
  actAs(users.M);
  const before = snap(data);
  const r = await editEmployee(data, 2, { turi: "moderator" });
  expect(r.status === 403 && r.body.error === ERR_ADMIN_ONLY, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Admin bo'lmagan xodim o'qituvchini moderator qiladi — ruxsat, hisob roli ham o'zgaradi", async () => {
  const { data, users } = seed();
  actAs(users.M);
  const r = await editEmployee(data, 4, { turi: "moderator" });
  expect(r.status === 200 && r.body.ok, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(roleOf(data, users.T) === "moderator", `hisob roli: ${roleOf(data, users.T)}`);
});

await holat("Admin o'zini administratorlikdan chiqara olmaydi — 409", async () => {
  const { data, users } = seed();
  actAs(users.A);
  const before = snap(data);
  const r = await editEmployee(data, 1, { turi: "moderator" });
  expect(r.status === 409 && /O'zingizni/.test(r.body.error ?? ""), `javob ${r.status} ${r.body.error ?? ""}`);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Lavozim o'zgarmasa (ism/telefon tahriri) eski nomuvofiq hisob roliga tegilmaydi", async () => {
  const { data, users } = seed();
  actAs(users.M);
  const r = await editEmployee(data, 8, { comment: "izoh" });
  expect(r.status === 200 && r.body.ok, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(roleOf(data, users.L) === "admin", `hisob roli jimgina o'zgardi: ${roleOf(data, users.L)}`);
});

await holat("Admin → Rollar'dagi qo'lda qo'shilgan rol — hisob roli «staff», admin huquqi olinadi", async () => {
  const { data, users } = seed();
  actAs(users.A);
  const r = await editEmployee(data, 2, { turi: "staff", centerRoleId: 9 });
  expect(r.status === 200 && r.body.ok, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(roleOf(data, users.B) === "staff", `hisob roli: ${roleOf(data, users.B)}`);
  expect(data.hr_employees.find((e) => e.id === 2).centerRoleId === 9, "rol id'si yozilmadi");
});

await holat("Telefon va lavozim bir so'rovda o'zgarsa ham hisob topiladi", async () => {
  const { data, users } = seed();
  actAs(users.A);
  const r = await editEmployee(data, 4, { phone: "909999999", turi: "moderator" });
  expect(r.status === 200 && r.body.ok, `javob ${r.status} ${r.body.error ?? ""}`);
  const t = data.users.find((x) => same(x._id, users.T._id));
  expect(t.role === "moderator" && t.phone === "998909999999", `hisob: ${t.role} ${t.phone}`);
});

await holat("/vaqtinchalik: admin adminni moderator qiladi — hisob roli ham moderator", async () => {
  const { data, users } = seed();
  actAs(users.A);
  const r = await editTemp(data, 2, { turi: "moderator" });
  expect(r.status === 200 && r.body.ok, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(roleOf(data, users.B) === "moderator", `hisob roli: ${roleOf(data, users.B)}`);
});

await holat("/vaqtinchalik: importdan (telefon bo'yicha bog'langan) hisob ham ergashadi", async () => {
  const { data, users } = seed();
  actAs(users.A);
  // Telefon YUBORILMAYDI: route'ning band raqam tekshiruvi (`hrEmployeeId: {$ne: id}`)
  // bog'lanmagan hisobni «boshqa hisob» deb 409 beradi — bu o'zgarishdan oldingi xulq.
  const r = await editTemp(data, 7, { turi: "moderator", phone: "" });
  expect(r.status === 200 && r.body.ok, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(roleOf(data, users.I) === "moderator", `hisob roli: ${roleOf(data, users.I)}`);
});

await holat("/vaqtinchalik: admin o'zini chiqara olmaydi — 409", async () => {
  const { data, users } = seed();
  actAs(users.A);
  const before = snap(data);
  const r = await editTemp(data, 1, { turi: "teacher" });
  expect(r.status === 409, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("/vaqtinchalik: vazifa tozalansa — hisob roli «employee»", async () => {
  const { data, users } = seed();
  actAs(users.A);
  const r = await editTemp(data, 4, { turi: "" });
  expect(r.status === 200 && r.body.ok, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(roleOf(data, users.T) === "employee", `hisob roli: ${roleOf(data, users.T)}`);
});

await holat("Oxirgi faol admin chiqarilmaydi — 409 (taklifdagi va tasdiq kutayotgan admin hisoblanmaydi)", async () => {
  const { data, users } = seed();
  // Faol adminlar: faqat A (B va L — moderator qilingan; Q taklifda, X tasdiq kutmoqda).
  for (const k of ["B", "L"]) data.users.find((x) => same(x._id, users[k]._id)).role = "moderator";
  const r = await checkLavozimChange(globalThis.__db, {
    empId: 1, phone: data.hr_employees[0].phone, fromTuri: "admin", toTuri: "moderator",
    admin: { id: new ObjectId().toHexString(), hrEmployeeId: 99 },
  });
  expect(!r.ok && r.status === 409 && /oxirgi faol administrator/.test(r.error), JSON.stringify(r));
});

await holat("Yangi xodim: admin bo'lmagan «Administrator» bilan qo'sha olmaydi — 403, xodim yaratilmaydi", async () => {
  const { data, users } = seed();
  actAs(users.M);
  const before = snap(data);
  const r = await hrList.POST(req("POST", { name: "Yangi Xodim", phone: "900000001", turi: "admin", centerRoleId: null }));
  expect(r.status === 403 && r.body.error === ERR_ADMIN_ONLY, `javob ${r.status} ${r.body.error ?? ""}`);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? "✓" : "✗"} ${r.title}${r.ok ? "" : `\n    → ${r.why}`}`);
}
console.log(bad ? `\n${bad} ta holat XATO (${results.length} tadan).` : `\nHammasi to'g'ri: ${results.length} ta holat.`);
process.exit(bad ? 1 : 0);
