// AI AMALLARI (2-bosqich) — qoralama → tasdiq → yadro, HAQIQIY MongoDB bilan.
//
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_verify-ai-actions.mjs
//
// Faqat LOKAL MongoDB (127.0.0.1 / localhost) bilan ishlaydi va ALOHIDA
// bazada (`crm_ai_actions_test`): boshida uni tozalab o'z sinov ma'lumotini
// yozadi, oxirida o'chiradi — ish bazasiga (MONGODB_DB) tegmaydi.
// Yozuvning o'zi web va xodimlar boti chaqiradigan o'sha yadrolardan
// o'tadi (lib/ordersCreate.ts, lib/cashboxAdjust.ts); Telegram, Sheets va
// SMS chaqirilmaydi (`defer` bo'sh).
import fs from "node:fs";
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
  }
}
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.MONGODB_URI || "")) {
  console.log("MONGODB_URI lokal MongoDB emas (mongodb://127.0.0.1:27017) — sinov ishlamaydi.");
  process.exit(1);
}
// lib/mongodb.ts baza nomini import paytida o'qiydi — undan OLDIN.
process.env.MONGODB_DB = "crm_ai_actions_test";

const { getDb } = await import("@/lib/mongodb");
await (await getDb()).dropDatabase();
{
  const db = await getDb();
  const tt = (id, name, mainType, customerType) => ({ id, name, minAmount: 0, maxAmount: 0, customerType, mainType, category: mainType === "kirim" ? "Kirim" : "Chiqim" });
  const totals = (naqd) => ({ naqd, plastik: 0, terminal: 0, ilovaClick: 0 });
  await db.collection("branches").insertMany([{ id: 1, name: "Akademiya 1 Chortoq" }, { id: 2, name: "Akademiya 2 Chortoq" }]);
  await db.collection("pupils").insertMany([
    { id: 1, firstName: "Ozodbek", lastName: "Nazarov", phone: "93 214 55 07" },
    { id: 2, firstName: "Malika", lastName: "Yusupova", phone: "94 331 09 42" },
    { id: 3, firstName: "Sardor", lastName: "Qodirov", phone: "90 187 63 25" },
  ]);
  await db.collection("groups").insertMany([{ id: 1, name: "101", course: "Ingliz tili", teacher: "Otabek Rasulov", status: "active", studentIds: [1, 2] }]);
  await db.collection("hr_employees").insertMany([
    { id: 1, name: "Otabek Rasulov", turi: "teacher", phone: "90 111 11 11" },
    { id: 6, name: "Dilmurod Komilov", turi: "moderator", phone: "90 222 22 22" },
    { id: 9, name: "Kamola Ergasheva", turi: "moderator", phone: "90 333 33 33" },
  ]);
  await db.collection("transaction_types").insertMany([
    tt(1, "Kurs to'lovi", "kirim", ["O'quvchilar", "Xodim"]),
    tt(2, "Kitob sotuvi", "kirim", ["Uchinchi shaxs"]),
    tt(3, "Avans", "chiqim", ["Xodim"]),
    tt(4, "Oylik ish haqi — o'qituvchi", "chiqim", ["Xodim"]),
    tt(5, "Kommunal to'lovlar", "chiqim", ["Boshqa"]),
  ]);
  await db.collection("offline_courses").insertMany([{ id: 1, name: "Matematika" }, { id: 2, name: "Ingliz tili" }]);
  await db.collection("cashboxes").insertMany([
    { id: 1, name: "Bosh kassa", moderator: "", isPrimary: true, archived: false, branchId: 1, balance: 5_000_000, methodTotals: totals(5_000_000) },
    { id: 2, name: "Dilmurod kassasi", moderator: "Dilmurod Komilov", isPrimary: false, archived: false, branchId: 1, balance: 1_000_000, methodTotals: totals(1_000_000) },
  ]);
}

const { aiDb } = await import("@/lib/ai/db");
const { isPathAllowed } = await import("@/lib/permissions");
const { prepareKirim, prepareChiqim, prepareLead, prepareTransfer, preparePupilComment, prepareTask } = await import("@/lib/ai/actions/prepare");
const { claimDraft, cancelDraft, finishAction, findAction, viewOf, attachActionViews, historyWithActionNotes, actionViews } = await import("@/lib/ai/actions/store");
const { checkAccess, executeAction } = await import("@/lib/ai/actions/execute");
const { runTool, toolsFor } = await import("@/lib/ai/tools/index");
const { AI } = await import("@/lib/ai/db");

const db = await aiDb();
let bad = 0;
const check = (name, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok || !detail ? "" : `   → ${detail}`}`);
};
const j = (x) => JSON.stringify(x);
const noDefer = { defer: () => {} };

function ctxOf({ userId, userName, employeeName = "", employeeId = null, isAdmin = false, permissions = null, actions = true }) {
  return {
    db,
    userId,
    userName,
    employeeName,
    employeeId,
    isAdmin,
    permissions,
    scope: { branchId: 1, allowed: [1, 2], isAdmin },
    branchName: "Akademiya 1 Chortoq",
    today: new Date().toISOString().slice(0, 10),
    can: (href) => isPathAllowed(href, permissions),
    actions,
  };
}
const admin = ctxOf({ userId: "admin-1", userName: "Sinov Admin", isAdmin: true });
const dilmurod = ctxOf({ userId: "emp-6", userName: "Dilmurod Komilov", employeeName: "Dilmurod Komilov", employeeId: 6, permissions: ["/finance-cash", "/orders-list", "/students-list"] });
const kamola = ctxOf({ userId: "emp-9", userName: "Kamola Ergasheva", employeeName: "Kamola Ergasheva", employeeId: 9, permissions: ["/groups"] });
const cashbox = async (id) => db.collection("cashboxes").findOne({ id }, { projection: { _id: 0, balance: 1, methodTotals: 1 } });

// ── Vositalar ro'yxati ────────────────────────────────────────────────
console.log("\n— ruxsat va bayroq");
const names = (c) => toolsFor(c).map((t) => t.name).filter((n) => n.startsWith("propose") || n === "action_options").sort();
check(
  "admin + amallar yoqiq — 7 ta amal vositasi",
  j(names(admin)) === j(["action_options", "propose_chiqim", "propose_kirim", "propose_lead", "propose_pupil_comment", "propose_task", "propose_transfer"]),
  j(names(admin)),
);
check("amallar o'chiq — amal vositasi yo'q", names({ ...admin, actions: false }).length === 0);
// /tasks hammaga ochiq — action_options ko'rinadi, lekin topshiriq berish (propose_task) rahbarga.
check("faqat Guruh ruxsati — faqat izoh (+ tanlovlar)", j(names(kamola)) === j(["action_options", "propose_pupil_comment"]), j(names(kamola)));
{
  const r = await runTool(kamola, "propose_kirim", j({ type: "Kurs to'lovi", pupil: "Ozodbek", amount: 1000, method: "Naqd" }));
  check("ruxsatsiz xodim propose_kirim chaqira olmaydi", !r.ok && r.content.includes("no access"), r.content);
  const off = await runTool({ ...admin, actions: false }, "propose_lead", "{}");
  check("amallar o'chiq bo'lsa vosita bajarilmaydi", !off.ok && off.content.includes("turned off"), off.content);
}

// ── Kirim: admin, bosh kassa ─────────────────────────────────────────
console.log("\n— kirim");
{
  const miss = await prepareKirim(admin, { type: "Kurs to'lovi", pupil: "Ozodbek" });
  check("summa yo'q — taxmin qilinmaydi, so'raladi", !miss.ok && /Amount is missing/.test(miss.reply.problem), j(miss));
  const many = await prepareKirim(admin, { type: "Kurs to'lovi", pupil: "ov", amount: 1000, method: "Naqd" });
  check("bir nechta o'quvchi — nomzodlar (telefon yashirilgan)", !many.ok && Array.isArray(many.reply.candidates) && many.reply.candidates.length > 1 && many.reply.candidates.every((c) => /\*\*\*/.test(c.phone)), j(many).slice(0, 300));
  const badType = await prepareKirim(admin, { type: "Sovg'a", pupil: "Ozodbek", amount: 1000, method: "Naqd" });
  check("noma'lum tur — ro'yxat qaytadi", !badType.ok && Array.isArray(badType.reply.types), j(badType));
  const badMonth = await prepareKirim(admin, { type: "Kurs to'lovi", pupil: "Ozodbek", amount: 1000, method: "Naqd", month: "2020-01" });
  check("ruxsat etilmagan oy rad etiladi", !badMonth.ok && Array.isArray(badMonth.reply.allowedMonths), j(badMonth));
  const third = await prepareKirim(admin, { type: "Kitob sotuvi", amount: 25000, method: "Naqd" });
  check("uchinchi shaxs — o'quvchi va oy so'ralmaydi", third.ok && !third.draft.payload.studentName && !third.draft.payload.periodMonth, j(third).slice(0, 300));

  const before = await cashbox(1);
  const tool = await runTool(admin, "propose_kirim", j({ type: "kurs to'lovi", pupil: "Ozodbek Nazarov", amount: 300000, method: "naqd", note: "AI sinov" }));
  const view = tool.action;
  check("qoralama tuzildi (karta + modelga xulosa)", tool.ok && view?.status === "draft" && JSON.parse(tool.content).status === "awaiting_user_confirmation", tool.content.slice(0, 200));
  check("qoralama paytida ekranda — Kassalar sahifasi (4-bosqich)", tool.screen === "/finance-cash", String(tool.screen));
  check("modelga to'liq telefon ketmaydi", !/93 214 55 07|932145507/.test(tool.content), tool.content);
  const doc = await findAction(db, admin.userId, view.id);
  check("bazada draft, kassa — bosh kassa (#1)", doc?.status === "draft" && doc.payload.cashboxId === 1 && doc.payload.amount === 300000, j(doc?.payload));
  check("hali hech narsa yozilmagan", (await cashbox(1)).balance === before.balance);

  check("begona xodim boshqaning qoralamasini topa olmaydi", (await findAction(db, dilmurod.userId, view.id)) === null);
  check("begona xodim tasdiqlay olmaydi (claim)", (await claimDraft(db, dilmurod.userId, view.id)) === null);

  const claimed = await claimDraft(db, admin.userId, view.id);
  const again = await claimDraft(db, admin.userId, view.id);
  check("tasdiq atomik: ikkinchi bosish hech narsa qilmaydi", claimed?.status === "executing" && again === null);
  check("tasdiq paytida ruxsat bor", (await checkAccess(admin, claimed)) === null);
  const out = await executeAction(admin, claimed, noDefer);
  check("yadro yozdi", out.ok && /^#\d+$/.test(out.resultText), j(out));
  const fin = await finishAction(db, claimed.id, out);
  check("qoralama — done", fin?.status === "done" && viewOf(fin).resultText === out.resultText);
  const after = await cashbox(1);
  check("kassa naqd +300 000", after.balance === before.balance + 300000 && after.methodTotals.naqd === before.methodTotals.naqd + 300000, j({ before, after }));
  const entry = await db.collection("transaction_entries").findOne({ id: out.result.entryId }, { projection: { _id: 0 } });
  check("jurnal yozuvi: origin ai, o'quvchi id bilan", entry?.origin === "ai" && entry.amount === 300000 && Number.isFinite(entry.pupilId) && entry.txType === "payIn", j(entry).slice(0, 400));
}

// ── Kirim: xodim faqat o'z kassasida ────────────────────────────────
console.log("\n— xodim kassasi");
{
  const own = await prepareKirim(dilmurod, { type: "Kurs to'lovi", pupil: "Malika", amount: 50000, method: "Naqd" });
  check("xodim — o'z kassasi (#2)", own.ok && own.draft.payload.cashboxId === 2, j(own).slice(0, 200));
  const foreign = await prepareKirim(dilmurod, { type: "Kurs to'lovi", pupil: "Malika", amount: 50000, method: "Naqd", cashboxId: 1 });
  check("xodim boshqa kassani tanlay olmaydi", !foreign.ok && /own cashbox/.test(foreign.reply.problem), j(foreign));
  // Admin tuzgan (#1 kassali) qoralamani xodim kontekstida tekshirsak — rad etiladi.
  const r = await runTool(admin, "propose_kirim", j({ type: "Kurs to'lovi", pupil: "Malika", amount: 1000, method: "Naqd" }));
  const doc = await findAction(db, admin.userId, r.action.id);
  check("tasdiqda kassa egaligi qayta tekshiriladi", (await checkAccess(dilmurod, doc))?.error === "Bu kassa sizga biriktirilmagan yoki arxivlangan");
  check("ruxsatsiz xodim uchun — amal ruxsati yo'q", (await checkAccess(kamola, doc))?.error === "Bu amalga ruxsatingiz yo'q");
  const c = await cancelDraft(db, admin.userId, doc.id);
  check("bekor qilish", c?.status === "cancelled" && (await claimDraft(db, admin.userId, doc.id)) === null);
}

// ── Chiqim ──────────────────────────────────────────────────────────
console.log("\n— chiqim");
{
  const tooMuch = await prepareChiqim(dilmurod, { type: "Kommunal to'lovlar", amount: 5_000_000, method: "Naqd" });
  check("kassada yetarli pul yo'q — rad", !tooMuch.ok && /Not enough money/.test(tooMuch.reply.problem), j(tooMuch));
  const before = await cashbox(2);
  const r = await runTool(dilmurod, "propose_chiqim", j({ type: "Kommunal", amount: 120000, method: "Naqd", note: "Svet" }));
  check("kommunal chiqim qoralamasi", r.ok && r.action?.kind === "chiqim", r.content);
  const claimed = await claimDraft(db, dilmurod.userId, r.action.id);
  check("xodim o'z kassasi uchun ruxsatli", (await checkAccess(dilmurod, claimed)) === null);
  const out = await executeAction(dilmurod, claimed, noDefer);
  await finishAction(db, claimed.id, out);
  const after = await cashbox(2);
  check("kassa −120 000, origin ai", out.ok && after.balance === before.balance - 120000, j(out));

  const avans = await prepareChiqim(admin, { type: "Avans", employee: "Otabek", amount: 100000, method: "Naqd" });
  check("avans — xodim topiladi, oy sukut bo'yicha joriy", avans.ok && avans.draft.payload.studentName === "Otabek Rasulov" && /^\d{4}-\d{2}$/.test(avans.draft.payload.periodMonth), j(avans).slice(0, 300));
  const future = await prepareChiqim(admin, { type: "Avans", employee: "Otabek", amount: 100000, method: "Naqd", month: "2099-01" });
  check("avans kelajak oy uchun — rad", !future.ok, j(future));
  const ambiguous = await prepareChiqim(admin, { type: "Avans", employee: "a", amount: 1000, method: "Naqd" });
  check("juda qisqa qidiruv — so'raladi", !ambiguous.ok, j(ambiguous));
}

// ── Lid ─────────────────────────────────────────────────────────────
console.log("\n— lid");
{
  const noCourse = await prepareLead(admin, { pupil: "Malika", days: "toq" });
  check("kurs yo'q — kurslar ro'yxati", !noCourse.ok && Array.isArray(noCourse.reply.courses), j(noCourse));
  const r = await runTool(admin, "propose_lead", j({ pupil: "Malika Yusupova", course: "matematika", days: "juft", note: "AI sinov lid" }));
  check("lid qoralamasi", r.ok && r.action?.kind === "lead", r.content);
  const doc = await claimDraft(db, admin.userId, r.action.id);
  const outside = { ...doc, payload: { ...doc.payload, branchId: 4 } };
  check("ruxsat yo'q filialga lid — rad", (await checkAccess(admin, outside))?.error === "Bu filialga ruxsatingiz yo'q");
  const out = await executeAction(admin, doc, noDefer);
  await finishAction(db, doc.id, out);
  const order = await db.collection("orders").findOne({ id: out.result.orderId }, { projection: { _id: 0 } });
  check("lid yozildi: kurs, kunlar, muallif, filial", order?.course === "Matematika" && order.lessonDay === "Se,Pa,Sh" && order.moderator === "Sinov Admin" && order.branchId === 1, j(order).slice(0, 300));
}

// ── 3-bosqich: boshqa kassaga ko'chirish ────────────────────────────
console.log("\n— ko'chirish");
{
  const box2 = await cashbox(2);
  const tooMuch = await prepareTransfer(dilmurod, { to: "Bosh", method: "Naqd", amount: box2.methodTotals.naqd + 1 });
  check("kassada yetarli pul yo'q — rad", !tooMuch.ok && /Not enough money/.test(tooMuch.reply.problem), j(tooMuch));
  const noDest = await prepareTransfer(dilmurod, { method: "Naqd", amount: 1000 });
  check("qabul qiluvchi aytilmagan — kassalar ro'yxati", !noDest.ok && j(noDest.reply.cashboxes) === j(["Bosh kassa"]), j(noDest));

  const r = await runTool(dilmurod, "propose_transfer", j({ to: "bosh kassa", method: "naqd", amount: 200000, note: "Kunlik tushum" }));
  check("ko'chirish qoralamasi: qayerdan → qayerga", r.ok && r.action?.kind === "transfer" && r.action.fields.some((f) => f.key === "to_cashbox" && f.value === "Bosh kassa"), r.content);
  const claimed = await claimDraft(db, dilmurod.userId, r.action.id);
  check("xodim o'z kassasidan jo'natadi — ruxsatli", (await checkAccess(dilmurod, claimed)) === null);
  check("arxivdagi/yo'q kassaga — rad", (await checkAccess(dilmurod, { ...claimed, payload: { ...claimed.payload, toCashboxId: 99 } }))?.error === "Qabul qiluvchi kassa topilmadi yoki arxivlangan");
  const out = await executeAction(dilmurod, claimed, noDefer);
  await finishAction(db, claimed.id, out);
  const after = await cashbox(2);
  check("pul qabul qilinmaguncha jo'natuvchida turadi", out.ok && after.balance === box2.balance && after.methodTotals.naqd === box2.methodTotals.naqd, j({ out, box2, after }));
  const pair = await db.collection("transaction_entries").find({ transferId: out.result.outEntryId }, { projection: { _id: 0 } }).toArray();
  check(
    "jurnalda juft yozuv: kutilmoqda, origin ai",
    pair.length === 2 && pair.every((e) => e.status === "waiting" && e.origin === "ai" && e.txType === "transfer") &&
      pair.some((e) => e.transferRole === "out" && e.cashboxId === 2 && e.amount === -200000) && pair.some((e) => e.transferRole === "in" && e.cashboxId === 1),
    j(pair).slice(0, 400),
  );
  const rest = await prepareTransfer(dilmurod, { to: "Bosh kassa", method: "Naqd", amount: box2.methodTotals.naqd - 100000 });
  check("mavjud = qoldiq − tasdiq kutayotgani", !rest.ok && rest.reply.available === box2.methodTotals.naqd - 200000, j(rest));
}

// ── 3-bosqich: o'quvchiga izoh ──────────────────────────────────────
console.log("\n— izoh");
{
  const noText = await preparePupilComment(kamola, { pupil: "Sardor" });
  check("matn yo'q — so'raladi, model o'zi yozmaydi", !noText.ok && /comment say/.test(noText.reply.problem), j(noText));
  const r = await runTool(kamola, "propose_pupil_comment", j({ pupil: "Sardor Qodirov", text: "Bugun darsga kech keldi" }));
  check("izoh qoralamasi", r.ok && r.action?.kind === "comment" && r.action.fields.some((f) => f.key === "comment" && f.value === "Bugun darsga kech keldi"), r.content);
  // Profil (/student-edit) «O'quvchilar ro'yxati» ruxsatiga bog'langan — faqat Guruh ruxsatli xodimga ochilmaydi.
  check("ekran: ruxsati yo'q profil ochilmaydi", r.screen === undefined, String(r.screen));
  const claimed = await claimDraft(db, kamola.userId, r.action.id);
  check("Guruh ruxsati bor — tasdiqlay oladi", (await checkAccess(kamola, claimed)) === null);
  check("Guruh ruxsati yo'q xodim — rad", (await checkAccess(dilmurod, claimed))?.error === "Bu amalga ruxsatingiz yo'q");
  const out = await executeAction(kamola, claimed, noDefer);
  await finishAction(db, claimed.id, out);
  const c = await db.collection("pupil_comments").findOne({ id: out.result?.commentId }, { projection: { _id: 0 } });
  check("izoh yozildi: o'quvchi, matn, muallif", out.ok && c?.pupilId === 3 && c.text === "Bugun darsga kech keldi" && c.by === "Kamola Ergasheva", j({ out, c }));
}

// ── 3-bosqich: xodimga topshiriq ────────────────────────────────────
console.log("\n— topshiriq");
{
  const deadline = `${new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)} 18:00`;
  const denied = await runTool(kamola, "propose_task", j({ title: "X", employees: ["Otabek"], deadline, priority: 2 }));
  check("rahbar bo'lmagan xodim — vosita yo'q", !denied.ok && denied.content.includes("no access"), denied.content);
  const noPriority = await prepareTask(admin, { title: "Hisobot", employees: ["Otabek"], deadline });
  check("muhimlik aytilmagan — jarimalar bilan so'raladi", !noPriority.ok && noPriority.reply.priorities?.length === 5, j(noPriority));

  const r = await runTool(admin, "propose_task", j({ title: "Oylik hisobot", employees: ["Otabek", "Dilmurod"], deadline, priority: 2, description: "Shu hafta" }));
  check("topshiriq qoralamasi: ikki xodim, jarima ko'rinadi", r.ok && r.action?.kind === "task" && r.action.fields.some((f) => f.key === "fine" && f.value === "20 000 so'm"), r.content);
  const claimed = await claimDraft(db, admin.userId, r.action.id);
  check("direktor — ruxsatli", (await checkAccess(admin, claimed)) === null);
  check("oddiy xodim kontekstida — rad", (await checkAccess(kamola, claimed))?.error === "Topshiriq berish uchun ruxsatingiz yo'q");
  const out = await executeAction(admin, claimed, noDefer);
  await finishAction(db, claimed.id, out);
  const tasks = await db.collection("staff_tasks").find({ id: { $in: out.result?.taskIds ?? [] } }, { projection: { _id: 0, history: 0 } }).toArray();
  check(
    "har xodimga alohida topshiriq, bitta to'plam",
    out.ok && tasks.length === 2 && new Set(tasks.map((t) => t.batchId)).size === 1 &&
      tasks.every((t) => t.status === "yangi" && t.priority === 2 && t.fineAmount === 20000 && t.createdBy.userId === "admin-1"),
    j({ out, tasks }).slice(0, 500),
  );
}

// ── Muddat va suhbat bilan bog'lash ─────────────────────────────────
console.log("\n— muddat, tarix");
{
  const r = await runTool(admin, "propose_kirim", j({ type: "Kitob sotuvi", amount: 5000, method: "Naqd" }));
  await db.collection(AI.actions).updateOne({ id: r.action.id }, { $set: { draftUntil: new Date(Date.now() - 1000) } });
  check("eskirgan qoralamani tasdiqlab bo'lmaydi", (await claimDraft(db, admin.userId, r.action.id)) === null);
  const views = await actionViews(db, admin.userId, [r.action.id]);
  check("ko'rinishda — expired", views.get(r.action.id)?.status === "expired");
  const msgs = [{ role: "assistant", content: "Tayyor.", at: "", actionIds: [r.action.id] }];
  const withViews = await attachActionViews(db, admin.userId, msgs);
  check("suhbatga karta holati qo'shiladi, id'lar mijozga ketmaydi", withViews[0].actions?.[0]?.status === "expired" && !("actionIds" in withViews[0]));
  const hist = historyWithActionNotes(msgs, views);
  check("modelga eslatma: eskirgan, saqlanmagan", /expired without confirmation/.test(hist[0].content) && !("actionIds" in hist[0]), hist[0].content);
}

await db.dropDatabase();
console.log(bad ? `\n${bad} ta tekshiruv o'tmadi.` : "\nHammasi to'g'ri.");
process.exit(bad ? 1 : 0);
