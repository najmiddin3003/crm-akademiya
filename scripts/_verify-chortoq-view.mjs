// «AKADEMIYA CHORTOQ» KO'RINISHI + AMALLAR JURNALI — bazasiz sinov (10.10.2026).
//
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_verify-chortoq-view.mjs
//
// Haqiqiy funksiyalar chaqiriladi (nusxa emas): navbar/filtr ro'yxatini
// yig'ish, bino yorlig'i, oylik/QR binosi ruxsati, jurnal uchun parol
// yashirish, yo'ldan bo'lim, amal nomlari.
const { collapseBranchPools, buildingNo, branchBuildingLabel, sameBranchPool } = await import("@/lib/branchPools");
const { payrollBuilding } = await import("@/lib/branchScope");
const { redactForLog, bodyForLog, sectionOf } = await import("@/lib/actionLog");
const { actionLabel, sectionLabel } = await import("@/lib/actionLogLabels");

let fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    kutilgan: ${JSON.stringify(want)}\n    chiqdi:   ${JSON.stringify(got)}`}`);
}

const all = [
  { id: 1, name: "Akademiya Chortoq" },
  { id: 2, name: "Akademiya Chortoq" },
  { id: 3, name: "Akademiya 3 Uychi" },
  { id: 4, name: "Akademiya 4 Uchqo'rg'on" },
];

console.log("— Filial ko'rinishi");
check("navbar: hovuz bitta qator (joriy 1)", collapseBranchPools(all, 1).map((b) => b.id), [1, 3, 4]);
check("navbar: joriy 2 bo'lsa o'sha qoladi", collapseBranchPools(all, 2).map((b) => b.id), [2, 3, 4]);
check("navbar: faqat 2 ruxsat — 2 ko'rinadi", collapseBranchPools([all[1]], null).map((b) => b.id), [2]);
check("navbar: boshqa filialda turib — hovuz vakili 1", collapseBranchPools(all, 3).map((b) => b.id), [1, 3, 4]);
check("bino raqami", [1, 2, 3, 4].map(buildingNo), [1, 2, null, null]);
check("bino yorlig'i", all.map((b) => branchBuildingLabel(b, (n) => `${n}-bino`)), [
  "Akademiya Chortoq · 1-bino",
  "Akademiya Chortoq · 2-bino",
  "Akademiya 3 Uychi",
  "Akademiya 4 Uchqo'rg'on",
]);
check("filtr: 1 tanlansa 2 ham mos", [sameBranchPool(2, 1), sameBranchPool(3, 1)], [true, false]);

console.log("— Oylik/QR binosi (payrollBuilding)");
const admin = { branchId: 1, allowed: [1, 2, 3, 4], isAdmin: true };
const only1 = { branchId: 1, allowed: [1], isAdmin: false };
const both = { branchId: 1, allowed: [1, 2], isAdmin: false };
const at3 = { branchId: 3, allowed: [1, 2, 3], isAdmin: false };
check("berilmasa — navbar filiali", payrollBuilding(both, undefined), 1);
check("hovuzdosh bino ruxsat bilan", payrollBuilding(both, "2"), 2);
check("hovuzdosh bino ruxsatsiz — yo'q", payrollBuilding(only1, 2), null);
check("admin — hovuzdosh bino", payrollBuilding(admin, 2), 2);
check("hovuzdan tashqari — yo'q (admin ham)", payrollBuilding(admin, 3), null);
check("navbar 3 da turib 1 — yo'q", payrollBuilding(at3, 1), null);
check("son emas — yo'q", payrollBuilding(both, "abc"), null);

console.log("— Amallar jurnali");
check(
  "parol va kodlar yashiriladi",
  redactForLog({ phone: "901234567", password: "x", new_password: "y", current_password: "z", code: "1234", initData: "q", apiKey: "k", amount: 5 }),
  { phone: "901234567", password: "***", new_password: "***", current_password: "***", code: "***", initData: "***", apiKey: "***", amount: 5 },
);
check("ichma-ich ham", redactForLog({ a: { b: [{ token: "t", ok: 1 }] } }), { a: { b: [{ token: "***", ok: 1 }] } });
const long = "x".repeat(400);
check("uzun satr qisqaradi", String(redactForLog(long)).length < 330, true);
check("JSON bo'lmagan tana yozilmaydi", bodyForLog("not json"), undefined);
check("katta tana — faqat kalitlar", (() => {
  const big = {};
  for (let i = 0; i < 300; i++) big[`k${i}`] = "y".repeat(100);
  const r = redactForLog(big);
  return r._qisqartirildi === true && Array.isArray(r.kalitlar) && r.kalitlar.length === 60;
})(), true);
check("yo'ldan bo'lim va obyekt", sectionOf("/api/cashboxes/5/adjust"), { section: "cashboxes", target: "5" });
check("ObjectId obyekt", sectionOf("/api/sessions/65f0c0ffee0000000000abcd"), { section: "sessions", target: "65f0c0ffee0000000000abcd" });
check("obyektsiz", sectionOf("/api/salary-runs"), { section: "salary-runs", target: null });
check("aniq amal nomi", actionLabel({ section: "cashboxes", action: "POST", path: "/api/cashboxes/5/adjust" }), "Kassa: kirim yoki chiqim");
check("oylik bekor qilish", actionLabel({ section: "salary-runs", action: "DELETE", path: "/api/salary-runs/12" }), "Oylik chiqarishni bekor qildi");
check("umumiy usul", actionLabel({ section: "groups", action: "PATCH", path: "/api/groups/7" }), "O'zgartirdi");
check("bot amali", actionLabel({ section: "cashboxes", action: "kirim" }), "Kassaga kirim (bot)");
check("bo'lim nomi / noma'lum", [sectionLabel("hr-employees"), sectionLabel("yangi-bolim")], ["Xodimlar", "yangi-bolim"]);

console.log(fail ? `\n${fail} ta xato.` : "\nHammasi to'g'ri.");
process.exit(fail ? 1 : 0);
