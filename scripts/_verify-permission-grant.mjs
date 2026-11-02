// «O'ZIDA BORINI BERADI» sinovi (02.11.2026): lib/permissionGrant.ts va uni chaqiradigan
// PATCH /api/hr-employees/:id, POST /api/hr-employees, POST /api/roles, PATCH /api/roles/:id,
// POST /api/hr-employees/import, lib/cvHire.ts (CV'dan ishga olish).
//
// Haqiqiy bazaga ham, tarmoqqa ham CHIQMAYDI (naqsh — scripts/_verify-lavozim-role.mjs): baza —
// xotiradagi soxta, sessiya va filial qamrovi — globalThis orqali, SMS kodi — o'chirilgan.
//
//   node --experimental-transform-types --no-warnings scripts/_verify-permission-grant.mjs
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
  // Yangi xodimga taklif SMS'i ketmasin: kod berilmaydi → SMS chaqirilmaydi.
  [fileUrl("lib/invite.ts")]: `export * from ${real("lib/invite.ts")};
    export async function issueCode() { return { ok: false }; }
    export async function sendActivationSms() { throw new Error("sinovda SMS yo'q"); }`,
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
// Nusxa: massivlar ham alohida (route qaytgan hujjatni o'zgartirsa baza buzilmasin). structuredClone
// EMAS — u ObjectId'ni oddiy obyektga aylantiradi va `_id` solishtirishlari jimgina yiqiladi.
const copy = (d) => {
  const o = { ...d };
  for (const [k, v] of Object.entries(o)) if (Array.isArray(v)) o[k] = [...v];
  return o;
};
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
          toArray: async () => list.map(copy),
        };
        return c;
      };
      return {
        find: (f) => cursor(rows.filter((d) => matches(d, f))),
        findOne: async (f) => {
          const d = rows.find((x) => matches(x, f));
          return d ? copy(d) : null;
        },
        countDocuments: async (f) => rows.filter((d) => matches(d, f)).length,
        insertOne: async (doc) => {
          const d = { _id: new ObjectId(), ...copy(doc) };
          rows.push(d);
          return { insertedId: d._id };
        },
        insertMany: async (docs) => {
          for (const doc of docs) rows.push({ _id: new ObjectId(), ...copy(doc) });
          return { insertedCount: docs.length };
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
          return copy(d);
        },
      };
    },
  };
}

// ── Ma'lumot: har holat toza nusxadan boshlanadi ─────────────────────────────
// Bo'limlar — constants/sidebar.js dagi haqiqiy kalitlar (noma'lumini sanitizePermissions tashlaydi).
const X = "/management-xodimlar", R = "/management-rollar", G = "/groups", D = "/nazorat-davomat", K = "/finance-cash";
const PHONE = { A: "901111111", M: "902222222", H: "903333333", T: "904444444", S: "905555555", E: "906666666", U: "907777777" };
const pretty = (k) => `${PHONE[k].slice(0, 2)} ${PHONE[k].slice(2, 5)} ${PHONE[k].slice(5, 7)} ${PHONE[k].slice(7)}`;
function seed() {
  const user = (k, emp, role) => ({ _id: new ObjectId(), phone: "998" + PHONE[k], hrEmployeeId: emp, fullName: `Xodim ${k}`, role, status: "active" });
  const users = {
    A: user("A", 1, "admin"), // admin
    M: user("M", 2, "moderator"), // menejer: moderator roli [X, R, G] — Rollar ham ochiq
    H: user("H", 3, "staff"), // kadrlar: «Yordamchi» roli [X] — faqat Xodimlar
    T: user("T", 4, "teacher"), // o'qituvchi [G, D]
    S: user("S", 5, "staff"), // «Kassir» roli [K]
    E: user("E", 6, "teacher"), // o'qituvchi, alohida ruxsat [G] (rolida D ham bor)
    U: user("U", 7, "employee"), // lavozimsiz — cheklovsiz (admin emas)
  };
  const emp = (id, k, turi, extra = {}) => ({ id, name: `Xodim ${k}`, phone: pretty(k), turi, branchIds: [3], payrollBranchId: 3, archReason: "", ...extra });
  const data = {
    users: Object.values(users),
    hr_employees: [
      emp(1, "A", "admin"), emp(2, "M", "moderator"), emp(3, "H", "staff", { centerRoleId: 11 }), emp(4, "T", "teacher"),
      emp(5, "S", "staff", { centerRoleId: 9 }), emp(6, "E", "teacher", { permissions: [G] }), emp(7, "U", ""),
    ],
    roles: [
      { id: 1, key: "teacher", name: "O'qituvchi", description: "", permissions: [G, D] },
      { id: 2, key: "moderator", name: "Moderator", description: "", permissions: [X, R, G] },
      { id: 9, name: "Kassir", description: "", permissions: [K] },
      { id: 10, name: "Rahbar", description: "", permissions: null }, // cheklovsiz
      { id: 11, name: "Yordamchi", description: "", permissions: [X] },
    ],
    branches: [{ id: 3, name: "Filial 3" }],
    cv_applications: [{ id: 1, ref: "CV-1", name: "Nomzod Bir", phone: "+998 90 123 45 67", status: "new" }],
  };
  globalThis.__db = fakeDb(data);
  return { data, users };
}

const { employeePermissions } = await import(fileUrl("lib/rolePermissions.ts"));
async function actAs(data, u) {
  const e = data.hr_employees.find((x) => x.id === u.hrEmployeeId);
  // getCurrentUser bilan bir xil: admin — null, qolganlar — xodim zanjiri (haqiqiy employeePermissions).
  const permissions = u.role === "admin" ? null : await employeePermissions(globalThis.__db, e);
  globalThis.__me = { id: String(u._id), phone: u.phone, fullName: u.fullName, role: u.role, permissions, hrEmployeeId: u.hrEmployeeId, lastSeenNotifAt: null };
  globalThis.__scope = { branchId: 3, allowed: [3], isAdmin: u.role === "admin" };
  return permissions;
}
const snap = (data) => JSON.stringify([data.users.map((u) => ({ ...u, _id: hex(u._id) })), data.hr_employees, data.roles, data.cv_applications]);
const empOf = (data, id) => data.hr_employees.find((e) => e.id === id);
const roleOf = (data, id) => data.roles.find((r) => r.id === id);

const hrItem = await import(fileUrl("app/api/hr-employees/[id]/route.ts"));
const hrList = await import(fileUrl("app/api/hr-employees/route.ts"));
const hrImport = await import(fileUrl("app/api/hr-employees/import/route.ts"));
const rolesList = await import(fileUrl("app/api/roles/route.ts"));
const rolesItem = await import(fileUrl("app/api/roles/[id]/route.ts"));
const { hireCv } = await import(fileUrl("lib/cvHire.ts"));

const req = (method, body) => new Request("http://sinov/api", { method, body: JSON.stringify(body) });
const ctx = (id) => ({ params: Promise.resolve({ id: String(id) }) });
/** Boshqaruv → Xodimlar tahrir oynasi kabi: ism, telefon, lavozim va rol har safar ketadi. */
function editEmployee(data, id, over) {
  const e = empOf(data, id);
  return hrItem.PATCH(req("PATCH", { name: e.name, phone: e.phone, turi: e.turi, centerRoleId: e.centerRoleId ?? null, ...over }), ctx(id));
}
/** Boshqaruv → Rollar → «Xodimga alohida ruxsat» oynasi kabi: faqat ro'yxat. */
const setException = (id, permissions) => hrItem.PATCH(req("PATCH", { permissions }), ctx(id));
const patchRole = (id, permissions) => rolesItem.PATCH(req("PATCH", { permissions }), ctx(id));

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
const said = (r) => `javob ${r.status} ${r.body?.error ?? ""}`;
const OK = (r) => expect(r.status === 200 && r.body.ok, said(r));
const DENIED = (r, re) => expect(r.status === 403 && re.test(r.body.error ?? ""), said(r));
const SELF = /^O'zingizga yangi bo'lim ocha olmaysiz/;
const ALL = /^Lavozimsiz yoki cheklovsiz rolli xodim barcha bo'limlarni/;
const BEYOND = /^O'zingizda yo'q bo'limni bera olmaysiz: /;
const ROLE_BEYOND = /^Rolga o'zingizda yo'q bo'limni qo'sha olmaysiz: /;
const ROLE_ALL = /^Hamma bo'lim belgilangan rol cheklovsiz bo'ladi/;

// ── O'ziga ──────────────────────────────────────────────────────────────────
await holat("Menejer o'ziga alohida ruxsat bilan Kassani ocha olmaydi — 403, baza o'zgarmaydi", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  const before = snap(data);
  DENIED(await setException(2, [X, R, G, K]), SELF);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Menejer o'z lavozimini bo'sh qilib (cheklovsiz) ola olmaydi — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  const before = snap(data);
  DENIED(await editEmployee(data, 2, { turi: "" }), SELF);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Menejer o'ziga Rollar'dagi «Kassir» rolini bera olmaydi — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  const before = snap(data);
  DENIED(await editEmployee(data, 2, { turi: "staff", centerRoleId: 9 }), SELF);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Kadrlar xodimi o'ziga kengroq «Moderator» lavozimini bera olmaydi — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.H);
  const before = snap(data);
  DENIED(await editEmployee(data, 3, { turi: "moderator", centerRoleId: null }), SELF);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("O'z ruxsatini toraytirish mumkin (Guruhni olib tashlash) — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  OK(await setException(2, [X, R]));
  expect(JSON.stringify(empOf(data, 2).permissions) === JSON.stringify([X, R]), "ro'yxat yozilmadi");
});

await holat("O'z ismini tuzatish (oyna lavozimni qayta yuboradi) to'silmaydi — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.H);
  OK(await editEmployee(data, 3, { name: "Xodim H Yangi" }));
  expect(empOf(data, 3).name === "Xodim H Yangi", "ism yozilmadi");
});

// ── Boshqaga alohida ruxsat ─────────────────────────────────────────────────
await holat("Menejer o'qituvchiga o'zida bor Xodimlar bo'limini bera oladi — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  OK(await setException(4, [G, X]));
});

await holat("Menejer o'qituvchiga o'zida yo'q Kassani bera olmaydi — 403, nomi xabarda", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  const before = snap(data);
  const r = await setException(4, [G, K]);
  DENIED(r, BEYOND);
  expect(/Kassalar/.test(r.body.error), `xabarda bo'lim nomi yo'q: ${r.body.error}`);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Xodimda allaqachon bor bo'limni (o'zida bo'lmasa ham) saqlab qolish mumkin — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  OK(await setException(4, [G, D]));
});

await holat("Alohida ruxsatni olib tashlash xodimga o'zida yo'q bo'limni qaytarsa — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  const before = snap(data);
  DENIED(await setException(6, null), BEYOND);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Rollar oynasida o'zgartirmay saqlash (Kassir roli ro'yxati) — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  OK(await setException(5, [K]));
});

// ── Lavozim / rol berish ────────────────────────────────────────────────────
await holat("Lavozim/rol berish avvalgidek: menejer o'qituvchini «Kassir» qiladi — 200, hisob roli ham", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  OK(await editEmployee(data, 4, { turi: "staff", centerRoleId: 9 }));
  expect(empOf(data, 4).centerRoleId === 9, "rol yozilmadi");
  expect(data.users.find((u) => same(u._id, users.T._id)).role === "staff", "hisob roli ergashmadi");
});

await holat("Boshqaning lavozimini bo'sh qilish (cheklovsiz) — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  const before = snap(data);
  DENIED(await editEmployee(data, 4, { turi: "" }), ALL);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Boshqaga ro'yxatsiz (cheklovsiz) «Rahbar» rolini berish — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  const before = snap(data);
  DENIED(await editEmployee(data, 4, { turi: "staff", centerRoleId: 10 }), ALL);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Boshqaning ismini tuzatish (rol qayta yuboriladi) to'silmaydi — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.H);
  OK(await editEmployee(data, 5, { name: "Kassir Yangi" }));
});

// ── Yangi xodim va CV ───────────────────────────────────────────────────────
await holat("Kadrlar xodimi o'qituvchi qo'sha oladi (o'qituvchi bo'limlari o'zida bo'lmasa ham) — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.H);
  const r = await hrList.POST(req("POST", { name: "Yangi Ustoz", phone: "900000001", turi: "teacher", centerRoleId: null }));
  OK(r);
  const u = data.users.find((x) => x.phone === "998900000001");
  expect(u && u.role === "teacher", `hisob: ${JSON.stringify(u)}`);
});

await holat("Yangi xodim bo'sh lavozim bilan (cheklovsiz) — 403, yaratilmaydi", async () => {
  const { data, users } = seed();
  await actAs(data, users.H);
  const before = snap(data);
  DENIED(await hrList.POST(req("POST", { name: "Yangi Xodim", phone: "900000002", turi: "", centerRoleId: null })), ALL);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Yangi xodim cheklovsiz «Rahbar» roli bilan — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.H);
  const before = snap(data);
  DENIED(await hrList.POST(req("POST", { name: "Yangi Rahbar", phone: "900000003", turi: "staff", centerRoleId: 10 })), ALL);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

const hireBody = (centerRoleId) => ({ startDate: "2026-11-02", salaryType: "fixed", oklad: 1000000, branchId: 3, centerRoleId });
await holat("CV'dan ishga olish: cheklovsiz rol bilan — 403, ariza o'zgarmaydi", async () => {
  const { data, users } = seed();
  const grantor = await actAs(data, users.H);
  const before = snap(data);
  const r = await hireCv(globalThis.__db, globalThis.__scope, 1, hireBody(10), "Xodim H", grantor);
  expect(!r.ok && r.status === 403 && ALL.test(r.error), JSON.stringify(r));
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("CV'dan ishga olish: Rollar'dagi oddiy rol bilan — o'tadi", async () => {
  const { data, users } = seed();
  const grantor = await actAs(data, users.H);
  const r = await hireCv(globalThis.__db, globalThis.__scope, 1, hireBody(9), "Xodim H", grantor);
  expect(r.ok, JSON.stringify(r));
  expect(data.cv_applications[0].status === "accepted", "ariza «Ishga olindi» bo'lmadi");
});

// ── Rollar ──────────────────────────────────────────────────────────────────
await holat("Kadrlar xodimi hamma bo'limli yangi rol yarata olmaydi (keyin o'ziga berardi) — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.H);
  const before = snap(data);
  DENIED(await rolesList.POST(req("POST", { name: "Hammasi", permissions: [X, R, G, D, K] })), ROLE_BEYOND);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("O'zida bor bo'limlar bilan yangi rol — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.H);
  OK(await rolesList.POST(req("POST", { name: "Kichik", permissions: [X] })));
});

await holat("Menejer rolga o'zida bor bo'limni qo'shadi — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  OK(await patchRole(9, [K, G]));
  expect(JSON.stringify(roleOf(data, 9).permissions) === JSON.stringify([K, G]), "rol yozilmadi");
});

await holat("Menejer rolga o'zida yo'q Davomatni qo'sha olmaydi — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  const before = snap(data);
  DENIED(await patchRole(9, [K, D]), ROLE_BEYOND);
  expect(snap(data) === before, "baza o'zgarib qoldi");
});

await holat("Menejer O'Z rolini (moderator) Kassa bilan kengaytira olmaydi — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  DENIED(await patchRole(2, [X, R, G, K]), ROLE_BEYOND);
});

await holat("Rolni cheklovsiz qilish (hammasi belgilangan) — 403", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  DENIED(await patchRole(1, null), ROLE_ALL);
});

await holat("Cheklovsiz rolni o'zgartirmay saqlash va toraytirish — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.M);
  OK(await patchRole(10, null));
  OK(await patchRole(10, [X]));
});

// ── Admin, cheklovsiz xodim, import ─────────────────────────────────────────
await holat("Admin hammasini bera oladi (alohida ruxsat, bo'sh lavozim, rol) — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.A);
  OK(await setException(4, [K, D, X]));
  OK(await editEmployee(data, 5, { turi: "", centerRoleId: null }));
  expect(empOf(data, 5).turi === "" && empOf(data, 5).centerRoleId === undefined, "lavozim bo'shatilmadi");
  OK(await patchRole(2, null));
});

await holat("Cheklovsiz (admin bo'lmagan) xodim ham bera oladi — 200", async () => {
  const { data, users } = seed();
  await actAs(data, users.U);
  OK(await setException(4, [K]));
});

await holat("Import: admin bo'lmagan «Administrator» qatorini qo'sha olmaydi, qolganlari qo'shiladi", async () => {
  const { data, users } = seed();
  await actAs(data, users.H);
  const r = await hrImport.POST(req("POST", { employees: [{ name: "Admin Bo'lmoqchi", turi: "Administrator" }, { name: "Oddiy Ustoz", turi: "O'qituvchi" }] }));
  OK(r);
  expect(r.body.created === 1 && r.body.skipped.length === 1 && /Administrator lavozimini/.test(r.body.skipped[0].reason), JSON.stringify(r.body));
  expect(!data.hr_employees.some((e) => e.turi === "admin" && e.name === "Admin Bo'lmoqchi"), "admin qatori yozilib qoldi");
});

await holat("Import: admin «Administrator» qatorini qo'sha oladi", async () => {
  const { data, users } = seed();
  await actAs(data, users.A);
  const r = await hrImport.POST(req("POST", { employees: [{ name: "Yangi Admin", turi: "Administrator" }] }));
  OK(r);
  expect(r.body.created === 1, JSON.stringify(r.body));
});

let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? "✓" : "✗"} ${r.title}${r.ok ? "" : `\n    → ${r.why}`}`);
}
console.log(bad ? `\n${bad} ta holat XATO (${results.length} tadan).` : `\nHammasi to'g'ri: ${results.length} ta holat.`);
process.exit(bad ? 1 : 0);
