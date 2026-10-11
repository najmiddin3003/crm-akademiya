// FAQAT O'QIYDI — AI vositalarini kechagi savollar bilan qayta yurgizish (11.10.2026).
//
//   node --env-file=.env.local --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_replay-ai-tools.mjs
//
// Haqiqiy runner (lib/ai/tools/index.ts → runTool) va vositalar chaqiriladi —
// model emas. 10.10 suhbatlaridagi savollar: oylik «barcha filiallar», ustozlar
// avansi, qarzdorlar; ruxsatsiz filial so'rovi rad etilishi. Ko'zgu bazada.
if (!process.env.MONGODB_URI) {
  console.log("MONGODB_URI yo'q (.env.local)");
  process.exit(1);
}
const { getDb } = await import("@/lib/mongodb");
const { runTool, toolSpecs, AI_TOOLS } = await import("@/lib/ai/tools/index");
const { collapseBranchPools } = await import("@/lib/branchPools");

const db = await getDb();
const all = (await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray()).map((b) => ({
  id: Number(b.id),
  name: String(b.name),
}));
const today = process.env.AI_TODAY || "2026-10-10";
let fail = 0;
const check = (label, ok, extra = "") => {
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
};

function ctxFor(branchId, isAdmin, allowedIds) {
  const allowed = isAdmin ? all.map((b) => b.id) : allowedIds;
  return {
    db,
    userId: "replay",
    userName: isAdmin ? "Admin" : "Xodim",
    employeeName: isAdmin ? "" : "Nilufar Sharipova",
    employeeId: null,
    isAdmin,
    permissions: null,
    scope: { branchId, allowed, isAdmin },
    branchName: all.find((b) => b.id === branchId)?.name ?? `#${branchId}`,
    branches: collapseBranchPools(all.filter((b) => allowed.includes(b.id)), branchId),
    today,
    can: () => true,
    actions: false,
    startedAt: new Date(),
  };
}

async function call(ctx, name, args) {
  const r = await runTool(ctx, name, JSON.stringify(args));
  let body = null;
  try {
    body = JSON.parse(r.content);
  } catch {
    body = r.content;
  }
  return { ok: r.ok, body };
}

const admin3 = ctxFor(3, true);
const nilufar1 = ctxFor(1, false, [1]);
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("ru-RU");

// 1) «barcha xodimlarga qancha oylik chiqyapti» — allBranches.
const pay = await call(admin3, "payroll_summary", { month: "2026-10", allBranches: true });
check("oylik: barcha filiallar — xato yo'q", pay.ok && !pay.body.error, pay.body.error || "");
console.log(`   jami: hisoblangan ${fmt(pay.body.totals?.earned)}, avans ${fmt(pay.body.totals?.advance)}, oylik to'langan ${fmt(pay.body.totals?.salaryPaid)}, to'lanadi ${fmt(pay.body.totals?.toPay)}`);
for (const b of pay.body.branches ?? []) console.log(`   · ${b.branch}: ${b.employees} xodim, hisoblangan ${fmt(b.totals.earned)}, to'lanadi ${fmt(b.totals.toPay)}`);
check("oylik: har ro'yxat alohida (1, 2, 3, 4)", (pay.body.branches ?? []).length === all.length);
check("oylik: natija 20 000 belgidan kichik", JSON.stringify(pay.body).length < 20000, `${JSON.stringify(pay.body).length} belgi`);

// 2) «har bir ustoz qancha avans olgan» — teacher, avans oy bo'yicha.
const adv = await call(admin3, "payroll_summary", { month: "2026-10", allBranches: true, position: "teacher" });
const withAdv = (adv.body.employees ?? []).filter((e) => e.advance);
check("avans: ustozlar, oy bo'yicha", adv.ok && withAdv.length > 0, `${withAdv.length} ustozda avans, jami ${fmt(adv.body.totals?.advance)}`);
check("avans: faqat teacher", (adv.body.employees ?? []).every((e) => e.position === "teacher"));
for (const e of withAdv.slice(0, 5)) console.log(`   · ${e.name} (${e.branch}): ${fmt(e.advance)}`);

// 3) Qarzdorlar — «all» (har filial alohida) va bitta boshqa filial.
const debt = await call(admin3, "debtors_report", { branch: "all", limit: 3 });
check("qarzdorlar: branch all → perBranch", Array.isArray(debt.body.perBranch), `${(debt.body.perBranch ?? []).length} ta filial`);
for (const b of debt.body.perBranch ?? []) console.log(`   · ${b.branch}: ${b.result.debtorsCount} qarzdor, ${fmt(b.result.totalDebt)}`);
const d4 = await call(admin3, "debtors_report", { branch: 4, limit: 1 });
check("qarzdorlar: branch 4 — o'sha filial nomi", d4.ok && String(d4.body.branch).includes("Uchqo"), d4.body.branch);

// 4) Ruxsat: Nilufar (faqat 1) 3-filialni so'ray olmaydi; "all" — faqat o'ziniki.
const deny = await call(nilufar1, "debtors_report", { branch: 3 });
check("ruxsat: boshqa filial rad etiladi", !deny.ok && /not available/.test(JSON.stringify(deny.body)));
const own = await call(nilufar1, "debtors_report", { branch: "all", limit: 1 });
check("ruxsat: all = faqat o'z filiali", own.ok && !own.body.perBranch && String(own.body.branch).includes("Chortoq"), own.body.branch);
const payDeny = await call(nilufar1, "payroll_summary", { allBranches: true });
check("ruxsat: oylik all = faqat o'z ro'yxati", payDeny.ok && (payDeny.body.branches ?? []).length === 1, (payDeny.body.branches ?? []).map((b) => b.branch).join(", "));

// 5) Sxema: branchAware vositada `branch` argumenti bor, boshqasida yo'q.
const specs = toolSpecs(AI_TOOLS);
const spec = (n) => specs.find((s) => s.function.name === n)?.function.parameters?.properties ?? {};
check("sxema: debtors_report.branch bor", "branch" in spec("debtors_report"));
check("sxema: finance_summary.branch yo'q", !("branch" in spec("finance_summary")));
check("sxema: payroll_summary.allBranches bor", "allBranches" in spec("payroll_summary"));

console.log(fail ? `\n${fail} ta xato.` : "\nHammasi to'g'ri.");
process.exit(fail ? 1 : 0);
