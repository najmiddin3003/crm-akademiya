// FAQAT O'QIYDI — avgust «nol-yopish» oyi kirimlaridan ustoz ulushi (11.10.2026).
//
//   node --env-file=.env.local --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_check-august-share.mjs [--json=fayl]
//
// Foydalanuvchi: «avgust oyiga qilingan to'lovlar yopilmaganmidi? sentabr
// oyligi to'liq berilgandan keyin avgustni tanlab yozilgan to'lov bo'lsa —
// qolaversin; sentabr oyligi chiqarilishidan OLDINGI avgust to'lovlari
// turgan bo'lsa — 0 qilamiz, chunki ular berilgan bo'ladi».
//
// Qoida (lib/salary.ts → foldCarryChain): avgust — nol-yopish oyi
// (salary_runs, kassasiz). Undan faqat FOIZLI ustozning «Avgust» kirimlari
// ulushi (foizPart − olingan) sentabrga «O'tgan oydan» bo'lib o'tadi.
// Bu skript har ustoz uchun ko'rsatadi:
//   • avgust kirimlari — sentabr oyligi chiqarilishidan OLDIN / KEYIN
//     yozilganlari (yozuvning tizim tamg'asi `createdAt`), ulushi bilan;
//   • sentabr chiqarishida (salary_runs chek kesimi) avgust ulushi bormidi
//     (`receipt.carryOver`) — ya'ni u pul o'sha chiqarishda berilganmi;
//   • HOZIR: sentabr sahifasidagi «O'tgan oydan» va «Qolgan», oktabrdagi
//     «o'tgan oylardan» (pending) — tizim nimani to'lanmagan deb turibdi.
import fs from "node:fs";

const { getDb } = await import("@/lib/mongodb");
const { buildPayrollRows, monthMatch } = await import("@/lib/payrollSources");
const { payrollPeriodOf, payrollFoizPart, payrollPaid, payrollDue, payrollHasFoiz, CLOSING_SALARY_RUN } = await import("@/lib/salary");

const AUG = "2026-08";
const SEP = "2026-09";
const OCT = "2026-10";
const jsonOut = process.argv.find((a) => a.startsWith("--json="))?.split("=")[1];

const db = await getDb();
const key = (v) => String(v ?? "").trim().toLowerCase();
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("ru-RU");

/** salary_runs.createdAt "DD.MM.YYYY | HH:mm" (Toshkent) → Date. */
function runTime(raw) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})\D+(\d{2}):(\d{2})/.exec(String(raw ?? ""));
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00+05:00`) : null;
}
/** Yozuv bazaga tushgan vaqt: `createdAt` (ISO), bo'lmasa date + time (Toshkent). */
function entryTime(e) {
  const c = e.createdAt ? new Date(e.createdAt) : null;
  if (c && !Number.isNaN(c.getTime())) return { at: c, src: "createdAt" };
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(e.date ?? "")) ? e.date : null;
  if (!d) return { at: null, src: "?" };
  const t = /^\d{2}:\d{2}/.test(String(e.time ?? "")) ? String(e.time).slice(0, 5) : "23:59";
  return { at: new Date(`${d}T${t}:00+05:00`), src: "date" };
}
const tash = (d) =>
  d ? new Date(d.getTime() + 5 * 3600_000).toISOString().replace("T", " ").slice(0, 16) : "—";

// ── 1. Oylik chiqarishlar ─────────────────────────────────────────────
const runs = await db
  .collection("salary_runs")
  .find({ month: { $in: [AUG, SEP, OCT] } }, { projection: { _id: 0 } })
  .sort({ id: 1 })
  .toArray();
console.log("OYLIK CHIQARISHLAR (salary_runs):");
for (const r of runs) {
  const closing = r.kind !== CLOSING_SALARY_RUN.kind.$ne;
  console.log(
    `  #${r.id} ${r.month} filial ${r.branchId ?? "?"} kassa ${r.cashboxId ?? "— (nol-yopish)"}${r.kind ? ` kind=${r.kind}` : ""}${closing ? "" : " (oyni yopmaydi)"} | ${r.createdAt} | ${r.employeeCount ?? r.items?.length ?? 0} xodim, to'langan ${fmt(r.tolangan)}`,
  );
}
// Xodim → sentabr chiqarishi(lar)i: vaqt va chekdagi «O'tgan oydan».
const sepPay = new Map(); // employeeId → [{runId, at, branchId, carryOver, paid}]
for (const r of runs.filter((x) => x.month === SEP && x.cashboxId != null && x.cashboxId !== "")) {
  for (const it of r.items ?? []) {
    const list = sepPay.get(Number(it.employeeId)) ?? [];
    list.push({ runId: r.id, at: runTime(r.createdAt), branchId: r.branchId, carryOver: Number(it.receipt?.carryOver) || 0, paid: Number(it.paid) || 0, kind: r.kind ?? "" });
    sepPay.set(Number(it.employeeId), list);
  }
}

// ── 2. Avgust kirimlari (ustoz ulushi asosi) ─────────────────────────
const augEntries = await db
  .collection("transaction_entries")
  .find(
    {
      $and: [{ $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }] }, { $or: monthMatch(AUG) }],
      status: { $ne: "cancelled" },
      teacherName: { $nin: ["", null] },
    },
    { projection: { _id: 0, id: 1, date: 1, time: 1, createdAt: 1, teacherName: 1, studentName: 1, amount: 1, discountSom: 1, txType: 1, periodMonth: 1, cashboxId: 1, moderator: 1, teacherShareSettled: 1 } },
  )
  .toArray();
const byTeacher = new Map();
for (const e of augEntries) {
  const k = key(e.teacherName);
  byTeacher.set(k, [...(byTeacher.get(k) ?? []), e]);
}

// ── 3. Hisob: avgust (zanjirsiz), sentabr va oktabr (zanjir bilan) ───
const pAug = payrollPeriodOf(AUG);
const pSep = payrollPeriodOf(SEP);
const pOct = payrollPeriodOf(OCT);
const [augRows, sepRows, octRows] = await Promise.all([
  buildPayrollRows(db, pAug, { carryOver: false }),
  buildPayrollRows(db, pSep),
  buildPayrollRows(db, pOct),
]);
const sepById = new Map(sepRows.map((e) => [e.id, e]));
const octById = new Map(octRows.map((e) => [e.id, e]));

const report = [];
for (const a of augRows) {
  if (!a.configured || !payrollHasFoiz(a)) continue;
  const entries = byTeacher.get(key(a.name)) ?? [];
  const share = payrollFoizPart(a) - payrollPaid(a);
  if (!entries.length && share === 0) continue;
  const pays = (sepPay.get(a.id) ?? []).filter((x) => x.kind !== "karta");
  const payAt = pays.length ? pays.reduce((m, x) => (x.at && (!m || x.at > m) ? x.at : m), null) : null;
  let before = 0;
  // `teacherShareSettled` — ulushi qo'lda berilgan deb belgilangan (11.10.2026,
  // scripts/settle-august-share-20261011.mjs): oylikka kirmaydi.
  let settled = 0;
  let after = 0;
  const lines = [];
  for (const e of entries) {
    const amt = Math.abs(Number(e.amount) || 0);
    const signed = e.txType === "payIn" ? amt + Math.abs(Number(e.discountSom) || 0) : -amt;
    const part = (signed * a.percent) / 100;
    const t = entryTime(e);
    const isAfter = payAt && t.at ? t.at > payAt : !payAt;
    if (e.teacherShareSettled) settled += part;
    else if (isAfter) after += part;
    else before += part;
    lines.push(
      `      #${e.id} ${e.date}${e.periodMonth ? ` (davr ${e.periodMonth})` : ""} yozilgan ${tash(t.at)}${t.src === "date" ? "*" : ""} «${e.studentName ?? ""}» ${fmt(signed)} → ulush ${fmt(part)} ${payAt ? (isAfter ? "KEYIN" : "oldin") : "(sentabr chiqarilmagan)"}${e.teacherShareSettled ? " — BERILGAN (oylikka kirmaydi)" : ""}`,
    );
  }
  const s = sepById.get(a.id);
  const o = octById.get(a.id);
  const row = {
    id: a.id,
    name: a.name,
    percent: a.percent,
    augCollected: a.collected,
    augFoiz: payrollFoizPart(a),
    augPaid: payrollPaid(a),
    share,
    before: Math.round(before),
    settled: Math.round(settled),
    after: Math.round(after),
    sepPayouts: pays.map((x) => ({ run: x.runId, at: tash(x.at), branchId: x.branchId, carryInReceipt: x.carryOver, paid: x.paid })),
    sepCarryNow: s?.carryOver ?? null,
    sepDueNow: s ? payrollDue(s, pSep) : null,
    octPendingNow: o?.carryPending ?? 0,
    octPendingMonths: o?.carryPendingMonths ?? [],
  };
  report.push(row);
  console.log(
    `\n■ #${a.id} ${a.name} — ${a.percent}% | avgust tushumi ${fmt(a.collected)}, ulush ${fmt(row.augFoiz)}, avgustda olgan ${fmt(row.augPaid)} → sentabrga o'tadigan ${fmt(share)}`,
  );
  console.log(
    `    sentabr chiqarishida oldin yozilganlar ulushi ${fmt(row.before)}, keyin yozilganlar ${fmt(row.after)}${row.settled ? `, berilgan deb belgilangan ${fmt(row.settled)}` : ""}`,
  );
  for (const l of lines) console.log(l);
  if (pays.length)
    for (const x of row.sepPayouts)
      console.log(`    sentabr chiqarishi #${x.run} (filial ${x.branchId}) ${x.at}: berilgan ${fmt(x.paid)}, chekdagi «O'tgan oydan» ${fmt(x.carryInReceipt)}`);
  else console.log("    sentabr oyligi chiqarilmagan (kassadan)");
  console.log(
    `    HOZIR: sentabr «O'tgan oydan» ${fmt(row.sepCarryNow)}, sentabr «Qolgan» ${fmt(row.sepDueNow)}, oktabrdagi o'tgan oylardan ${fmt(row.octPendingNow)}${row.octPendingMonths.length ? ` (${row.octPendingMonths.map((m) => `${m.month}: ${fmt(m.amount)}`).join(", ")})` : ""}`,
  );
}

const sum = (f) => report.reduce((s, r) => s + (Number(f(r)) || 0), 0);
console.log(`\nJAMI ${report.length} ustoz: sentabrga o'tadigan avgust ulushi ${fmt(sum((r) => r.share))}`);
console.log(`  sentabr chiqarishidan OLDIN yozilgan kirimlar ulushi: ${fmt(sum((r) => r.before))}`);
console.log(`  sentabr chiqarishidan KEYIN yozilgan kirimlar ulushi:  ${fmt(sum((r) => r.after))}`);
console.log(`  «berilgan» deb belgilangan (oylikka kirmaydi):        ${fmt(sum((r) => r.settled))}`);
console.log(`  sentabr chiqarishida chekka kirgan «O'tgan oydan»: ${fmt(sum((r) => r.sepPayouts.reduce((s, x) => s + x.carryInReceipt, 0)))}`);
console.log(`  HOZIR sentabr «Qolgan» (shu ustozlar, musbat): ${fmt(sum((r) => Math.max(r.sepDueNow ?? 0, 0)))}`);
if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({ runs: runs.map(({ items, ...r }) => ({ ...r, items: items?.length })), report }, null, 1), "utf8");
  console.log(`JSON: ${jsonOut}`);
}
process.exit(0);
