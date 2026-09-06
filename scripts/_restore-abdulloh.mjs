import { MongoClient } from "mongodb";
import fs from "node:fs";

// ABDULLOH RAXMATULLAYEV (id 1) — SINOVDAN OLDINGI HOLATGA QAYTARISH.
//
// NIMA UCHUN BOR: 06.09.2026 da plastik oylik va ikki oyoqli to'lovni
// sinash uchun uning ma'lumoti VAQTINCHA o'zgartirildi. Kelishuv bo'yicha
// 07.09.2026 soat 18:00 da avvalgi holatiga qaytariladi.
//
// SINOVDAN OLDINGI HOLAT (o'lchangan, taxmin emas):
//   branchAssignments: [{ branchId: 3, roleId: null, scheduleId: null, salary: 5000000 }]
//   taxIds:            []
//   plastikSalary:     maydon UMUMAN YO'Q edi (null ham emas)
//   turi/branchIds/payrollBranchId: moderator / [1] / 1 — TEGILMAGAN
//
// SINOV UCHUN QO'YILGANI:
//   oklad 5 000 000 → 10 000 000, qator Uychi → Chortoq 1
//   taxIds [] → [5] ("216 000")
//   plastikSalary yo'q → 2 000 000
//
// OKLAD QATORINING FILIALI — FOYDALANUVCHI QARORI (06.09.2026):
// qator **Akademiya 1 Chortoq** da qolsin. Sinovdan oldin u Uychiga
// teglangan edi, holbuki xodim kartasi Chortoq 1 da — ya'ni bu 5 ta
// nomuvofiqlikdan biri edi va endi hal qilindi.
//
// Shu sabab qaytarishda `--filial-chortoq` ISHLATILADI: summa asl holiga
// (5 000 000) qaytadi, filial esa Chortoq 1 da qoladi. Bayroqsiz variant
// ataylab saqlangan — u qatorni Uychiga, ya'ni XATO holatga qaytaradi va
// faqat qaror o'zgarsa kerak bo'ladi.
//
// FOYDALANISH:
//   node scripts/_restore-abdulloh.mjs                          # ko'rsatadi, yozmaydi
//   node scripts/_restore-abdulloh.mjs --yes --filial-chortoq   # ← KELISHILGAN VARIANT
//   node scripts/_restore-abdulloh.mjs --yes                    # qatorni Uychiga qaytaradi (eski xato holat)

const APPLY = process.argv.includes("--yes");
const KEEP_CHORTOQ = process.argv.includes("--filial-chortoq");

const BEFORE = {
  id: 1,
  name: "Abdulloh Raxmatullayev",
  branchAssignments: [{ branchId: 3, roleId: null, scheduleId: null, salary: 5000000 }],
  taxIds: [],
  // `plastikSalary` — maydon yo'q edi, shuning uchun $set emas, $unset.
};

const uri = /^MONGODB_URI=(.*)$/m.exec(fs.readFileSync(".env.local", "utf8"))[1].trim().replace(/^["']|["']$/g, "");
const client = new MongoClient(uri);
await client.connect();
const db = client.db("crm-akademiya-nextjs");
const col = db.collection("hr_employees");

const now = await col.findOne({ id: BEFORE.id });
if (!now) {
  console.error(`❌ id=${BEFORE.id} topilmadi`);
  await client.close();
  process.exit(1);
}

const assignments = KEEP_CHORTOQ
  ? [{ branchId: 1, roleId: null, scheduleId: null, salary: 5000000 }]
  : BEFORE.branchAssignments;

const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
console.log(`═══ ${now.name} (id ${now.id}) ═══\n`);
console.log("                    HOZIR                 QAYTARILADI");
console.log(`  oklad         ${fmt(now.branchAssignments?.[0]?.salary).padStart(12)}   →   ${fmt(assignments[0].salary).padStart(12)}`);
console.log(`  qator filiali ${String(now.branchAssignments?.[0]?.branchId).padStart(12)}   →   ${String(assignments[0].branchId).padStart(12)}${KEEP_CHORTOQ ? "  (--filial-chortoq)" : ""}`);
console.log(`  taxIds        ${JSON.stringify(now.taxIds ?? []).padStart(12)}   →   ${JSON.stringify(BEFORE.taxIds).padStart(12)}`);
console.log(`  plastikSalary ${String(now.plastikSalary ?? "(yo'q)").padStart(12)}   →   ${"(o'chiriladi)".padStart(12)}`);

if (!APPLY) {
  console.log("\n(--yes qo'shilmadi — hech narsa yozilmadi)");
  await client.close();
  process.exit(0);
}

const res = await col.findOneAndUpdate(
  { id: BEFORE.id },
  { $set: { branchAssignments: assignments, taxIds: BEFORE.taxIds }, $unset: { plastikSalary: "" } },
  { returnDocument: "after" },
);

const ok =
  res.branchAssignments?.[0]?.salary === assignments[0].salary &&
  res.branchAssignments?.[0]?.branchId === assignments[0].branchId &&
  (res.taxIds ?? []).length === 0 &&
  res.plastikSalary === undefined;

console.log(`\n${ok ? "✅ QAYTARILDI" : "❌ QAYTARISH TO'LIQ BAJARILMADI — tekshiring"}`);
console.log(`  oklad=${fmt(res.branchAssignments?.[0]?.salary)} · filial=${res.branchAssignments?.[0]?.branchId} · taxIds=${JSON.stringify(res.taxIds ?? [])} · plastikSalary=${res.plastikSalary ?? "(yo'q)"}`);

await client.close();
process.exit(ok ? 0 : 1);
