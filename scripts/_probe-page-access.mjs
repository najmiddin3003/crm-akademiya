// SAHIFA RUXSATI QARORINI HAQIQIY KOD BILAN TEKSHIRADI.
//
// `lib/permissions.ts` → `isPathAllowed()` — proxy.ts va (app)/layout.tsx
// ikkalasi ham AYNAN shu funksiyani chaqiradi. Bu skript uni bazadagi
// HAQIQIY rol ruxsatlari bilan sinaydi, ya'ni qarorni taxmin qilmaydi.
//
// Foydalanish:  node scripts/_probe-page-access.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";

const OUT = ".salarytest";
const CFG = "tsconfig.pagetest.json";

fs.writeFileSync(CFG, JSON.stringify({
  extends: "./tsconfig.json",
  compilerOptions: {
    noEmit: false, outDir: OUT, rootDir: ".", module: "esnext",
    moduleResolution: "bundler", target: "es2022", declaration: false,
    jsx: "preserve", allowJs: true, checkJs: false,
  },
  include: ["lib/permissions.ts", "constants/sidebar.js"],
}, null, 2));

execFileSync("npx", ["tsc", "-p", CFG], { stdio: "inherit", shell: true });
fs.unlinkSync(CFG);

const permPath = path.join(OUT, "lib/permissions.js");
fs.writeFileSync(
  permPath,
  fs.readFileSync(permPath, "utf8").replace(/"@\/constants\/([^"]+)"/g, '"../constants/$1.js"'),
);
const { isPathAllowed, firstAllowedPath } = await import(pathToFileURL(path.resolve(permPath)).href);

const uri = /^MONGODB_URI=(.*)$/m.exec(fs.readFileSync(".env.local", "utf8"))[1].trim().replace(/^["']|["']$/g, "");
const client = new MongoClient(uri);
await client.connect();
const db = client.db("crm-akademiya-nextjs");

// Sinaladigan sahifalar: ikkitasi boshqaruv (moderatorda bo'lmasligi
// kerak), ikkitasi kundalik (bo'lishi kerak).
const PAGES = ["/management-filiallar", "/management-xodimlar", "/orders-list", "/tasks"];

const roles = await db.collection("roles").find({}).toArray();
console.log("═══ SAHIFA RUXSATI — bazadagi haqiqiy rollar bilan ═══\n");
console.log("ROL".padEnd(18) + PAGES.map((p) => p.padStart(24)).join(""));
console.log("─".repeat(18 + PAGES.length * 24));

let problems = 0;
for (const r of roles) {
  const perms = Array.isArray(r.permissions) ? r.permissions : null;
  const cells = PAGES.map((p) => {
    const ok = isPathAllowed(p, perms);
    return (ok ? "OCHIQ" : "yopiq").padStart(24);
  });
  const tag = perms === null ? " (CHEKLOVSIZ)" : ` (${perms.length} yo'l)`;
  console.log((String(r.key ?? r.name).slice(0, 17)).padEnd(18) + cells.join("") + tag);
  // Moderatorda boshqaruv sahifalari YOPIQ bo'lishi kerak.
  if (r.key === "moderator" && isPathAllowed("/management-filiallar", perms)) problems++;
}

// Dilmurodning HAQIQIY zanjiri: users → hr_employees → roles.
const u = await db.collection("users").findOne({ fullName: { $regex: "dilmurod", $options: "i" } });
if (u) {
  const emp = await db.collection("hr_employees").findOne({ id: u.hrEmployeeId });
  const role = await db.collection("roles").findOne({ key: emp?.turi });
  // lib/rolePermissions.ts qoidasi: xodim istisnosi bo'lsa u, aks holda rol.
  const perms = Array.isArray(emp?.permissions)
    ? emp.permissions
    : (Array.isArray(role?.permissions) ? role.permissions : null);
  console.log(`\nDILMUROD: users.role="${u.role}" · turi="${emp?.turi}" · ruxsat manbai: ` +
    (Array.isArray(emp?.permissions) ? "xodim istisnosi" : role ? `rol "${role.key}"` : "YO'Q → cheklovsiz"));
  for (const p of PAGES) {
    const ok = isPathAllowed(p, perms);
    console.log(`  ${p.padEnd(24)} ${ok ? "OCHIQ" : "yopiq"}`);
  }
  const denied = firstAllowedPath(perms);
  console.log(`  taqiqlangan sahifadan yo'naltiriladi → ${denied}`);
  if (isPathAllowed("/management-filiallar", perms)) problems++;
}

await client.close();
console.log(`\n${problems === 0 ? "NATIJA: ✅ boshqaruv sahifalari moderatorga YOPIQ" : `NATIJA: ❌ ${problems} ta muammo`}`);
process.exit(problems === 0 ? 0 : 1);
