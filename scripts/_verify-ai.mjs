// AI yordamchining bazasiz va tarmoqsiz sinovi — sof mantiq:
// raqam yashirish, OpenAI oqimini yig'ish, xavfsiz markdown, vositalar
// ruxsati, argument tekshiruvi, qo'llanma qidiruvi, sozlama chegaralari;
// oxirida model ↔ vositalar sikli soxta OpenAI serveri bilan (127.0.0.1).
//
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_verify-ai.mjs
//
// Bazaga tegadigan vositalar (qarzdorlar, oylik …) bu yerda SINALMAYDI —
// ular sahifalar ishlatadigan yadrolarni chaqiradi (lib/debtors.ts,
// lib/payrollSources.ts …), o'zlari hisob qilmaydi.
const { maskPhone } = await import("@/lib/ai/mask");
const { applyChunk, emptyState, SseLineBuffer, stateFromMessage } = await import("@/lib/ai/sse");
const { parseAiMarkdown, parseInline, isInternalHref } = await import("@/components/ai/aiMarkdown");
const { findHelpSections } = await import("@/lib/ai/knowledge");
const { optDate, optMonth, optInt, monthRange, daysInclusive, ToolInputError } = await import("@/lib/ai/tools/types");
const { leadCreatedIso } = await import("@/lib/ai/tools/leads");
const { normalizeAiSettings, DEFAULT_DAILY_LIMIT } = await import("@/lib/ai/settings");
const { AI_TOOLS, toolAllowed, runTool } = await import("@/lib/ai/tools/index");
const { TOOL_LABELS } = await import("@/lib/ai/toolLabels");
const { isPathAllowed } = await import("@/lib/permissions");

let bad = 0;
function check(name, ok, detail = "") {
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok || !detail ? "" : `   → ${detail}`}`);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const throwsInput = (fn) => {
  try {
    fn();
    return false;
  } catch (e) {
    return e instanceof ToolInputError;
  }
};

// ── Raqam yashirish ────────────────────────────────────────────────────
console.log("\n— maskPhone");
check("bazadagi shakl", maskPhone("94 155 88 55") === "94 *** ** 55", maskPhone("94 155 88 55"));
check("xalqaro shakl", maskPhone("+998 93 065 34 35") === "93 *** ** 35", maskPhone("+998 93 065 34 35"));
check("bo'sh", maskPhone("") === "" && maskPhone(null) === "");
check("qisqa raqam ochilmaydi", maskPhone("1234") === "***");
check("to'liq raqam natijada yo'q", !maskPhone("941558855").includes("1558"));

// ── OpenAI oqimi ───────────────────────────────────────────────────────
console.log("\n— SSE / applyChunk");
{
  const buf = new SseLineBuffer();
  const a = buf.push('data: {"x":1}\n\ndata: {"y"');
  const b = buf.push(':2}\r\n: izoh\nevent: foo\ndata: [DONE]\n');
  check("qatorlar bo'lakdan to'g'ri yig'iladi", eq(a, ['{"x":1}']) && eq(b, ['{"y":2}', "[DONE]"]), JSON.stringify([a, b]));
  const c = new SseLineBuffer();
  c.push("data:{\"z\":3}");
  check("oxirgi qator \\n siz ham olinadi (flush)", eq(c.flush(), ['{"z":3}']));
}
{
  const s = emptyState();
  const texts = [
    { choices: [{ delta: { role: "assistant", content: "Sa" } }] },
    { choices: [{ delta: { content: "lom" } }] },
  ].map((ch) => applyChunk(s, ch));
  check("matn bo'laklari", s.content === "Salom" && eq(texts, ["Sa", "lom"]));
}
{
  const s = emptyState();
  for (const ch of [
    { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_a", type: "function", function: { name: "debtors_report", arguments: "" } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"li' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 1, id: "call_b", function: { name: "overview", arguments: "{}" } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'mit":5}' } }] } }] },
    { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
  ]) applyChunk(s, ch);
  check(
    "ikki vosita, argumentlar bo'laklab, index bo'yicha",
    eq(s.calls, [
      { id: "call_a", name: "debtors_report", arguments: '{"limit":5}' },
      { id: "call_b", name: "overview", arguments: "{}" },
    ]) && s.finishReason === "tool_calls",
    JSON.stringify(s),
  );
}
{
  const s = emptyState();
  applyChunk(s, { error: { message: "quota exceeded" } });
  check("oqim ichidagi xato", s.error === "quota exceeded");
  const m = stateFromMessage({
    choices: [{ message: { content: null, tool_calls: [{ id: "c1", function: { name: "crm_help", arguments: '{"topic":"lid"}' } }] }, finish_reason: "tool_calls" }],
  });
  check("oqimsiz javob (proksi)", m.calls.length === 1 && m.calls[0].name === "crm_help" && m.finishReason === "tool_calls");
}

// ── Markdown ────────────────────────────────────────────────────────────
console.log("\n— aiMarkdown");
check("ichki havola", isInternalHref("/reports-unpaid") && isInternalHref("/student-edit/12?src=list"));
check("tashqi havola rad etiladi", !isInternalHref("https://evil.example") && !isInternalHref("//evil.example") && !isInternalHref("javascript:alert(1)"));
check(
  "inline: qalin, kod, ichki havola",
  eq(parseInline("**Jami:** `5` ta, [Qarzdorlar](/reports-unpaid)"), [
    { kind: "bold", text: "Jami:" },
    { kind: "text", text: " " },
    { kind: "code", text: "5" },
    { kind: "text", text: " ta, " },
    { kind: "link", text: "Qarzdorlar", href: "/reports-unpaid" },
  ]),
);
check(
  "tashqi havola faqat matn bo'lib qoladi",
  eq(parseInline("[bosing](https://evil.example/x)"), [{ kind: "text", text: "bosing" }]),
);
{
  const blocks = parseAiMarkdown("Salom\nikkinchi qator\n\n- bir\n- ikki\n1. birinchi\n2) ikkinchi\n## Sarlavha");
  check(
    "bloklar: paragraf, ul, ol, sarlavha → qalin",
    blocks.length === 4 && blocks[0].kind === "p" && blocks[0].lines.length === 2 &&
      blocks[1].kind === "ul" && blocks[1].items.length === 2 &&
      blocks[2].kind === "ol" && blocks[2].items.length === 2 &&
      blocks[3].kind === "p" && blocks[3].lines[0][0].kind === "bold",
    JSON.stringify(blocks),
  );
  check("HTML matn sifatida qoladi", eq(parseInline("<img src=x onerror=1>"), [{ kind: "text", text: "<img src=x onerror=1>" }]));
}

// ── Vositalar ruxsati ──────────────────────────────────────────────────
console.log("\n— vositalar ruxsati");
// `visible` — sahifadan tashqari shart (topshiriq berish faqat rahbar/direktorga), toolsFor() dagi kabi.
// `isAdmin` — sukut bo'yicha cheklovsiz (perms === null) xodim admin (query_data faqat adminga).
const toolsFor = (perms, actions = false, isAdmin = perms === null) =>
  AI_TOOLS.filter(
    (tool) => toolAllowed(tool, (href) => isPathAllowed(href, perms), actions) && (!tool.visible || tool.visible({ isAdmin, permissions: perms })),
  ).map((tool) => tool.name).sort();
check("admin / cheklovsiz — o'qish vositalari hammasi", toolsFor(null).length === AI_TOOLS.filter((x) => !x.action).length);
check("amallar yoqilsa — admin uchun hammasi", toolsFor(null, true).length === AI_TOOLS.length);
check(
  "amallar: kassa ruxsati — kirim/chiqim/ko'chirish; lid, izoh, topshiriq emas",
  eq(toolsFor(["/finance-cash"], true).filter((n) => n.startsWith("propose") || n === "action_options"), ["action_options", "propose_chiqim", "propose_kirim", "propose_transfer"]),
  JSON.stringify(toolsFor(["/finance-cash"], true)),
);
check("amallar o'chiq — amal vositasi ko'rinmaydi", !toolsFor(null, false).some((n) => n.startsWith("propose")));
check(
  "faqat Guruh ruxsati — guruhlar, davomat + umumiylar (topshiriqlar va reja hammaga)",
  eq(toolsFor(["/groups"]), ["attendance_report", "crm_help", "list_groups", "overview", "staff_tasks", "update_plan"]),
  JSON.stringify(toolsFor(["/groups"])),
);
check(
  "Lidlar + O'quvchilar",
  eq(toolsFor(["/orders-list", "/students-list"]), ["crm_help", "leads_summary", "overview", "pupil_details", "search_pupils", "staff_tasks", "update_plan"]),
  JSON.stringify(toolsFor(["/orders-list", "/students-list"])),
);
// 5-bosqich vositalari.
check("query_data — faqat admin", toolsFor(null).includes("query_data") && !toolsFor(null, false, false).includes("query_data") && !toolsFor(["/groups"]).includes("query_data"));
check(
  "payments_list — Tranzaksiyalar yoki Kassalar ruxsati",
  toolsFor(["/finance-transactions"]).includes("payments_list") && toolsFor(["/finance-cash"]).includes("payments_list") && !toolsFor(["/groups"]).includes("payments_list"),
);
check(
  "yangi amallar — o'z sahifasi ruxsati bilan",
  eq(
    toolsFor(["/students-list"], true).filter((n) => n.startsWith("propose")),
    ["propose_new_pupil", "propose_pupil_status"],
  ) &&
    eq(toolsFor(["/groups"], true).filter((n) => n.startsWith("propose")), ["propose_attendance", "propose_group_membership", "propose_pupil_comment"]) &&
    eq(toolsFor(["/orders-list"], true).filter((n) => n.startsWith("propose")), ["propose_lead", "propose_lead_stage"]),
  JSON.stringify([toolsFor(["/students-list"], true), toolsFor(["/groups"], true), toolsFor(["/orders-list"], true)]),
);
check("Kassa ruxsati oylikni ochmaydi", !toolsFor(["/finance-cash"]).includes("payroll_summary") && toolsFor(["/finance-cash"]).includes("cashbox_balances"));
check("Moliya hisobotlari — finance_summary", toolsFor(["/finance-reports"]).includes("finance_summary"));
check(
  "Nazorat → Davomat — o'quvchi va xodim davomati",
  ["attendance_report", "staff_attendance"].every((n) => toolsFor(["/nazorat-davomat"]).includes(n)),
  JSON.stringify(toolsFor(["/nazorat-davomat"])),
);
check(
  "xodim davomati — turniket yoki Xodimlar ruxsati, Guruh emas",
  toolsFor(["/nazorat-turnstile-io"]).includes("staff_attendance") && toolsFor(["/management-xodimlar"]).includes("staff_attendance") &&
    !toolsFor(["/groups"]).includes("staff_attendance"),
);
check("voronka — faqat Sotuv voronkasi ruxsati", toolsFor(["/reports-funnel"]).includes("sales_funnel") && !toolsFor(["/orders-list"]).includes("sales_funnel"));
check(
  "topshiriq berish — faqat /tasks bo'lim ruxsati yoki direktor",
  toolsFor(["/tasks"], true).includes("propose_task") && toolsFor(null, true).includes("propose_task") && !toolsFor(["/finance-cash", "/groups"], true).includes("propose_task"),
);
check("izoh — Guruh ruxsati", toolsFor(["/groups"], true).includes("propose_pupil_comment") && !toolsFor(["/students-list"], true).includes("propose_pupil_comment"));
check("har vositaning yorlig'i bor", AI_TOOLS.every((tool) => TOOL_LABELS.some((x) => x.name === tool.name)));

const fakeCtx = (perms, actions = false) => ({ can: (href) => isPathAllowed(href, perms), actions, permissions: perms, isAdmin: false });
{
  const r = await runTool(fakeCtx(["/groups"]), "payroll_summary", "{}");
  check("ruxsatsiz vosita bajarilmaydi", !r.ok && r.content.includes("no access"), r.content);
  const off = await runTool(fakeCtx(null, false), "propose_kirim", "{}");
  check("amallar o'chiq — amal vositasi bajarilmaydi", !off.ok && off.content.includes("turned off"), off.content);
  const task = await runTool(fakeCtx(["/finance-cash"], true), "propose_task", "{}");
  check("rahbar bo'lmagan xodim topshiriq qoralamasini tuza olmaydi", !task.ok && task.content.includes("no access"), task.content);
  const u = await runTool(fakeCtx(null), "drop_database", "{}");
  check("noma'lum vosita", !u.ok && u.content.includes("Unknown tool"));
  const j = await runTool(fakeCtx(null), "crm_help", "{not json");
  check("buzilgan JSON argument", !j.ok && j.content.includes("JSON object"));
  const a = await runTool(fakeCtx(null), "crm_help", "[1,2]");
  check("massiv argument rad etiladi", !a.ok);
  const h = await runTool(fakeCtx(["/orders-list"]), "crm_help", JSON.stringify({ topic: "Lid qanday qo'shiladi?" }));
  const hv = JSON.parse(h.content);
  check("crm_help: lid bo'limi topiladi", h.ok && hv.sections[0]?.title === "Lid qo'shish", h.content.slice(0, 200));
  const pages = JSON.stringify(hv.pagesUserCanOpen);
  check("crm_help: faqat ochiq sahifalar", pages.includes("/orders-list") && !pages.includes("/finance-cash") && !pages.includes("/blok-test"), pages.slice(0, 300));
}

// ── Argumentlar ────────────────────────────────────────────────────────
console.log("\n— argumentlar");
check("sana to'g'ri", optDate({ d: "2026-02-28" }, "d") === "2026-02-28");
check("yo'q kun rad etiladi", throwsInput(() => optDate({ d: "2026-02-30" }, "d")));
check("format rad etiladi", throwsInput(() => optDate({ d: "28.02.2026" }, "d")));
check("oy", optMonth({ m: "2026-09" }, "m") === "2026-09" && throwsInput(() => optMonth({ m: "2026-13" }, "m")));
check("son chegarasi", optInt({ n: "5" }, "n", 1, 30) === 5 && throwsInput(() => optInt({ n: 31 }, "n", 1, 30)) && optInt({}, "n", 1, 30) === null);
check("monthRange fevral", eq(monthRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" }));
check("daysInclusive", daysInclusive("2026-01-01", "2026-12-31") === 365);
check("lid sanasi", leadCreatedIso("08.04.2026 | 14:08") === "2026-04-08" && leadCreatedIso("") === "");

// ── Qo'llanma qidiruvi ─────────────────────────────────────────────────
console.log("\n— qo'llanma");
const first = (q) => findHelpSections(q)[0]?.id;
check("to'lov", first("o‘quvchidan to‘lov qanday qabul qilinadi") === "payment-in", first("o‘quvchidan to‘lov qanday qabul qilinadi"));
check("parol", first("parolni o'zgartirmoqchiman") === "security", first("parolni o'zgartirmoqchiman"));
check("davomat", first("davomat qanday qilinadi") === "attendance", first("davomat qanday qilinadi"));
check("mos kelmasa bo'sh", findHelpSections("ob-havo qanaqa").length === 0);

// ── Sozlamalar ─────────────────────────────────────────────────────────
console.log("\n— sozlamalar");
check(
  "sukut — o'chiq (amallar ham); modellar — admin tanlamagan, «Tezlik» — Tez",
  eq(normalizeAiSettings(null), {
    enabled: false,
    actionsEnabled: false,
    dailyLimit: DEFAULT_DAILY_LIMIT,
    models: null,
    defaultModel: null,
    defaultEffort: "low",
    updatedBy: null,
    updatedAt: null,
  }),
  JSON.stringify(normalizeAiSettings(null)),
);
check(
  "modellar: yaroqsiz va takror tashlanadi, bo'sh ro'yxat — null",
  eq(normalizeAiSettings({ models: ["gpt-6-sol", "gpt-6-sol", "bad id", 5] }).models, ["gpt-6-sol"]) && normalizeAiSettings({ models: [] }).models === null,
);
check(
  "sukut daraja: noma'lumi (max) — Tez",
  normalizeAiSettings({ defaultEffort: "max" }).defaultEffort === "low" && normalizeAiSettings({ defaultEffort: "high" }).defaultEffort === "high",
);
{
  // Yaroqsiz qiymat bazaga yetmasdan rad etiladi (db kerak emas).
  const { saveAiSettings, MAX_MODELS } = await import("@/lib/ai/settings");
  const errOf = async (patch) => (await saveAiSettings(null, patch, "sinov")).error;
  check(
    "sozlama saqlash: bo'sh ro'yxat, yomon ID, juda ko'p model, noma'lum daraja — rad",
    (await errOf({ models: [] })) === "Kamida bitta model tanlang" &&
      (await errOf({ models: ["a b"] })) === "Model nomi noto'g'ri" &&
      (await errOf({ models: Array.from({ length: MAX_MODELS + 1 }, (_, i) => `m${i}`) })) === `Ko'pi bilan ${MAX_MODELS} ta model` &&
      (await errOf({ defaultEffort: "max" })) === "Noto'g'ri qiymat" &&
      (await errOf({ defaultModel: "../x" })) === "Model nomi noto'g'ri",
  );
}
check("amallar faqat true bo'lsa", normalizeAiSettings({ actionsEnabled: "true" }).actionsEnabled === false && normalizeAiSettings({ actionsEnabled: true }).actionsEnabled === true);
check("yaroqsiz limit sukutga", normalizeAiSettings({ enabled: true, dailyLimit: 0 }).dailyLimit === DEFAULT_DAILY_LIMIT);
check("enabled faqat true bo'lsa", normalizeAiSettings({ enabled: "true" }).enabled === false);

// ── Amallar (2-bosqich) — bazasiz qism ─────────────────────────────────
console.log("\n— amallar");
{
  const { lessonDayCodes, pickByName, fmtSum, allowedMonths } = await import("@/lib/ai/actions/prepare");
  const { viewOf, historyWithActionNotes } = await import("@/lib/ai/actions/store");
  const { systemPrompt } = await import("@/lib/ai/prompt");
  check("dars kunlari: toq / juft / har kuni", eq(lessonDayCodes("toq kunlar"), ["Du", "Ch", "Ju"]) && eq(lessonDayCodes("Juft"), ["Se", "Pa", "Sh"]) && lessonDayCodes("har kuni").length === 6);
  check("dars kunlari: aniq kunlar", eq(lessonDayCodes("Ch, Du"), ["Du", "Ch"]) && lessonDayCodes("ertaga").length === 0);
  const items = ["Kurs to'lovi", "Kitob sotuvi", "Kurs to'lovi (qarz)"];
  check("nom: aniq moslik ustun", pickByName(items, (x) => x, "kurs to’lovi") === "Kurs to'lovi");
  check("nom: noaniq qisman moslik — taxmin yo'q", pickByName(items, (x) => x, "kurs") === null && pickByName(items, (x) => x, "kitob") === "Kitob sotuvi");
  check("summa ko'rinishi", fmtSum(1250000) === "1 250 000 so'm");
  const km = allowedMonths("kirim");
  const pm = allowedMonths("payout");
  check("oylar: kirim 3 ta (o'tgan·shu·keyingi), oylik 2 ta", km.months.length === 3 && km.months[1] === km.current && pm.months.length === 2 && pm.months[1] === pm.current);
  const doc = { id: "a1", kind: "kirim", status: "draft", fields: [], payload: {}, draftUntil: new Date(Date.now() - 1000) };
  check("muddati o'tgan qoralama — expired", viewOf(doc).status === "expired" && viewOf({ ...doc, draftUntil: new Date(Date.now() + 60_000) }).status === "draft");
  const notes = historyWithActionNotes(
    [{ role: "assistant", content: "Tayyor.", at: "", actionIds: ["a1"] }],
    new Map([["a1", { id: "a1", kind: "kirim", status: "done", fields: [], expiresAt: "", resultText: "#7" }]]),
  );
  check("tarixda qoralama taqdiri modelga yoziladi", /saved \(#7\)/.test(notes[0].content) && !("actionIds" in notes[0]), notes[0].content);
  const base = { today: "2026-10-07", branchName: "Markaz", userName: "X", isAdmin: false };
  check(
    "ko'rsatma: amallar yoqilsa — tasdiq qoidasi, o'chiq bo'lsa — o'zgartira olmaydi",
    /must press «Tasdiqlash»/.test(systemPrompt({ ...base, actions: true }, "uz")) && /You cannot change any data/.test(systemPrompt({ ...base, actions: false }, "uz")),
  );
  check(
    "ko'rsatma: 3-bosqich amallari tilga olingan",
    ["propose_transfer", "propose_pupil_comment", "propose_task"].every((n) => systemPrompt({ ...base, actions: true }, "uz").includes(n)),
  );
  const tnote = historyWithActionNotes(
    [{ role: "assistant", content: "Tayyor.", at: "", actionIds: ["t1"] }],
    new Map([["t1", { id: "t1", kind: "transfer", status: "done", fields: [], expiresAt: "", resultText: "#55" }]]),
  );
  check("ko'chirma taqdiri modelga: qabul qiluvchi hali tasdiqlaydi", /cashbox transfer/.test(tnote[0].content) && /saved \(#55\)/.test(tnote[0].content), tnote[0].content);
}

// ── 3-bosqich: davomat, topshiriqlar, voronka, qoralama yordamchilari ──
// Sof hisob — bazasiz (vositalar shu funksiyalarni chaqiradi).
console.log("\n— 3-bosqich (sof hisob)");
{
  const { dayRange, summarizeAttendance, missingCheckIns } = await import("@/lib/ai/tools/attendance");
  const today = "2026-10-08"; // payshanba
  check("oraliq: sukut — bugun", eq(dayRange({}, today), { from: today, to: today }));
  check("oraliq: faqat from — bugungacha; faqat to — o'sha kun", eq(dayRange({ from: "2026-10-01" }, today), { from: "2026-10-01", to: today }) && eq(dayRange({ to: "2026-10-03" }, today), { from: "2026-10-03", to: "2026-10-03" }));
  check("oraliq: teskari va juda uzun rad etiladi", throwsInput(() => dayRange({ from: "2026-10-05", to: "2026-10-01" }, today)) && throwsInput(() => dayRange({ from: "2026-01-01", to: "2026-10-01" }, today)));

  const groups = [
    { id: 1, label: "Ingliz tili (101-guruh)", teacher: "Otabek Rasulov", status: "active", day: "Toq kunlar", startDate: "2026-09-01" },
    { id: 2, label: "Matematika (102-guruh)", teacher: "Kamola Ergasheva", status: "frozen", day: "Toq kunlar", startDate: "2026-09-01" },
    // Boshlanish sanasi yo'q — /nazorat-missed-groups kabi "davomat qilinmagan" ga sanalmaydi.
    { id: 3, label: "Fizika (103-guruh)", teacher: "Dilshod Aliyev", status: "active", day: "Toq kunlar", startDate: "" },
  ];
  const marks = [
    { groupId: 1, pupilId: 1, date: "2026-10-05", status: "keldi" },
    { groupId: 1, pupilId: 2, date: "2026-10-05", status: "sababsiz" },
    { groupId: 1, pupilId: 3, date: "2026-10-05", status: "sababli", reason: "Qattiq kasal bo'lgan" },
    { groupId: 2, pupilId: 4, date: "2026-10-06", status: "kechikdi" },
  ];
  const names = new Map([[2, "Malika Yusupova"], [3, "Sardor Qodirov"], [4, "Ozodbek Nazarov"]]);
  const s = summarizeAttendance({ from: "2026-10-05", to: today, today, groups, marks, pupilNames: names, status: "" });
  check(
    "davomat: keldi+kechikdi — bor, sababli+sababsiz — qoldirgan, foiz",
    s.totalMarks === 4 && s.present === 2 && s.missed === 2 && s.attendancePercent === 50,
    JSON.stringify({ total: s.totalMarks, present: s.present, missed: s.missed, pct: s.attendancePercent }),
  );
  check(
    "davomat: ro'yxatda qoldirganlar, ism va sabab bilan",
    s.marksTotal === 2 && s.marks.some((m) => m.student === "Sardor Qodirov" && m.reason === "Qattiq kasal bo'lgan") && s.marks.every((m) => m.mark !== "Keldi"),
    JSON.stringify(s.marks),
  );
  check(
    "davomat qilinmagan: aktiv guruhning chorshanbasi, muzlatilgan guruh emas",
    s.notMarkedTotal === 1 && s.notMarked[0].date === "2026-10-07" && s.notMarked[0].group === "Ingliz tili (101-guruh)",
    JSON.stringify(s.notMarked),
  );
  check(
    "davomat qilinmagan: boshlanish sanasiz guruh sanalmaydi, alohida aytiladi",
    !s.notMarked.some((x) => x.group === "Fizika (103-guruh)") && eq(s.groupsWithoutStartDate, ["Fizika (103-guruh)"]),
    JSON.stringify({ notMarked: s.notMarked, without: s.groupsWithoutStartDate }),
  );
  check("davomat: guruhlar kesimi — eng ko'p qoldirgan birinchi", s.groups[0].group === "Ingliz tili (101-guruh)" && s.groups[0].attendancePercent === 33.3 && s.groups[1].attendancePercent === 100);
  const late = summarizeAttendance({ from: "2026-10-05", to: today, today, groups, marks, pupilNames: names, status: "kechikdi" });
  check("davomat: belgi filtri — faqat shu belgi", late.marksTotal === 1 && late.marks[0].student === "Ozodbek Nazarov");

  const missing = missingCheckIns({
    date: today,
    today,
    nowMin: 600,
    staff: [
      { id: 1, name: "Otabek Rasulov", turi: "teacher" },
      { id: 2, name: "Kamola Ergasheva", turi: "teacher" },
      { id: 6, name: "Dilmurod Komilov", turi: "moderator" },
      { id: 9, name: "Ali Valiyev", turi: "admin" },
      { id: 10, name: "Zarina", turi: "moderator" },
    ],
    groups: [{ label: "Ingliz tili (101-guruh)", teacher: "otabek  rasulov ", time: "14:00 - 15:30", status: "active", day: "Hafta kunlari" }],
    workStart: "09:00",
    records: [
      { date: today, personName: "Ali Valiyev", employeeId: 9, enterTime: "08:55", exitTime: null, status: "kelgan" },
      { date: today, personName: "zarina", employeeId: null, enterTime: "09:10", exitTime: null, status: "kechikkan" },
    ],
  });
  check(
    "kelmaganlar: darsi bor ustoz (hali vaqti emas) va ish vaqti o'tgan xodim; darssiz ustoz va kelganlar yo'q",
    eq(missing.map((m) => [m.employee, m.expectedAt, !!m.notYetDue]), [["Dilmurod Komilov", "09:00", false], ["Otabek Rasulov", "14:00", true]]),
    JSON.stringify(missing),
  );
  check("kelmaganlar: kelajak kuni va ish vaqti yo'q filial", missingCheckIns({ date: "2026-10-09", today, nowMin: 0, staff: [{ id: 6, name: "D", turi: "moderator" }], groups: [], workStart: "09:00", records: [] }).length === 0 && missingCheckIns({ date: today, today, nowMin: 0, staff: [{ id: 6, name: "D", turi: "moderator" }], groups: [], workStart: null, records: [] }).length === 0);

  const { summarizeTasks, isOverdue } = await import("@/lib/ai/tools/tasks");
  const now = Date.parse("2026-10-08T07:00:00Z");
  const task = (id, employeeName, status, deadline, extra = {}) => ({ id, title: `T${id}`, employeeId: id, employeeName, priority: 3, deadline, status, updatedAt: `2026-10-0${id}`, ...extra });
  const tasks = [
    task(1, "Ali", "yangi", "2026-10-07T13:00:00.000Z"),
    task(2, "Ali", "yangi", "2026-10-10T13:00:00.000Z"),
    task(3, "Vali", "muddati_otdi", "2026-10-05T13:00:00.000Z"),
    task(4, "Vali", "tasdiq_kutilmoqda", "2026-10-06T13:00:00.000Z"),
    task(5, "Vali", "yakunlandi", "2026-10-01T13:00:00.000Z", { completedLate: true }),
    task(6, "Ali", "bajarilmadi", "2026-10-02T13:00:00.000Z"),
  ];
  const open = summarizeTasks(tasks, "open", now);
  check("topshiriqlar: muddati o'tgan — avtomatika kechiksa ham", open.overdue === 2 && isOverdue(tasks[0], now) && !isOverdue(tasks[3], now) && !isOverdue(tasks[4], now));
  check("topshiriqlar: ochiqlar tartibi — avval muddati o'tganlar", eq(open.tasks.map((t) => t.id), [3, 1, 4, 2]), JSON.stringify(open.tasks.map((t) => t.id)));
  check(
    "topshiriqlar: filtrlar va xodimlar kesimi",
    eq(summarizeTasks(tasks, "overdue", now).tasks.map((t) => t.id), [3, 1]) && eq(summarizeTasks(tasks, "done", now).tasks.map((t) => t.id), [5]) &&
      eq(open.byEmployee.map((e) => [e.employee, e.open, e.overdue]), [["Ali", 2, 1], ["Vali", 2, 1]]),
    JSON.stringify(open.byEmployee),
  );

  const { funnelSummary } = await import("@/lib/ai/tools/funnel");
  const fs = funnelSummary([
    { status: "Kelmoqda", stage: "", source: "bot", course: "Ingliz tili" },
    { status: "Qabul qilindi", stage: "rahmaaaat", source: "bot", course: "Ingliz tili" },
    { status: "Bekor qilindi", stage: "", source: "Sayt", course: "Matematika" },
  ]);
  check("voronka: 4 qadam sahifadagi bilan bir xil", eq(fs.steps.map((x) => x.count), [3, 1, 1, 1]) && fs.steps[1].percentOfAll === 33.3, JSON.stringify(fs.steps));
  check(
    "voronka: manbalar kesimi",
    eq(fs.bySource.find((x) => x.source === "bot"), { source: "bot", leads: 2, trialBooked: 1, cameToTrial: 1, firstPayment: 1, paidPercent: 50 }),
    JSON.stringify(fs.bySource),
  );

  const { parseTaskDeadline, resolveAssignees } = await import("@/lib/ai/actions/prepare");
  const d1 = parseTaskDeadline("2026-10-09 18:00", now);
  check("muddat: Toshkent vaqti", d1.ok && d1.value.iso === "2026-10-09T13:00:00.000Z" && d1.value.label === "09.10.2026 | 18:00" && !d1.value.defaultedTime, JSON.stringify(d1));
  const d2 = parseTaskDeadline("2026-10-09", now);
  check("muddat: faqat sana — 18:00 va modelga aytiladi", d2.ok && d2.value.label === "09.10.2026 | 18:00" && d2.value.defaultedTime);
  check("muddat: o'tgan vaqt — so'raladi", !parseTaskDeadline("2026-10-08T09:30", now).ok && !parseTaskDeadline("", now).ok);
  check(
    "muddat: yo'q sana / soat rad etiladi",
    throwsInput(() => parseTaskDeadline("2026-02-30 10:00", now)) && throwsInput(() => parseTaskDeadline("2026-10-09 24:00", now)) && throwsInput(() => parseTaskDeadline("9 oktabr", now)),
  );

  const pick = [
    { id: 1, name: "Ali Valiyev", pos: "Moderator", branchId: 1 },
    { id: 2, name: "Ali Karimov", pos: "", branchId: 1 },
    { id: 3, name: "Vali Toshev", pos: "", branchId: 1 },
  ];
  const ids = (r) => (r.ok ? r.value.map((e) => e.id) : r.reply);
  check("kimga: aniq ism (katta-kichik harfsiz) va yagona qisman moslik", eq(ids(resolveAssignees(pick, { employees: ["ali valiyev"] })), [1]) && eq(ids(resolveAssignees(pick, { employees: "Toshev" })), [3]));
  const amb = resolveAssignees(pick, { employees: ["ali"] });
  check("kimga: noaniq — nomzodlar, taxmin yo'q", !amb.ok && amb.reply.candidates?.length === 3, JSON.stringify(amb));
  check(
    "kimga: id + ism; ro'yxatda yo'q id va bo'sh — so'raladi",
    eq(ids(resolveAssignees(pick, { employeeIds: [1], employees: ["Toshev"] })), [1, 3]) && !resolveAssignees(pick, { employeeIds: [99] }).ok && !resolveAssignees(pick, {}).ok,
  );
  check("kimga: noto'g'ri tur rad etiladi", throwsInput(() => resolveAssignees(pick, { employees: [5] })) && throwsInput(() => resolveAssignees(pick, { employeeIds: "1" })));
}

// ── 4-bosqich: model va «Tezlik», Responses oqimi — sof qism ───────────
console.log("\n— 4-bosqich (modellar, Responses oqimi, ekran)");
{
  const { AI_MODEL_CATALOG, nearestEffort, isModelId, modelInfo } = await import("@/lib/ai/models");
  const { modelChoices, resolveChoice, adminModelIds } = await import("@/lib/ai/modelChoice");
  const { screenOf } = await import("@/lib/ai/tools/index");
  const R = await import("@/lib/ai/responsesSse");

  check("daraja: bor bo'lsa o'zi", nearestEffort("medium", ["low", "medium", "high"]) === "medium");
  check("daraja: Astra'da «Tezkor» yo'q — «Tez»", nearestEffort("none", ["low", "medium", "high"]) === "low");
  check("daraja: teng masofada chuqurrog'i", nearestEffort("medium", ["low", "high"]) === "high");
  check("daraja: ro'yxat bo'sh — null (yuborilmaydi)", nearestEffort("low", []) === null);
  check(
    "model ID: yaroqli / yaroqsiz",
    isModelId("gpt-6.1-sol") && isModelId("ft:gpt-5.6:org:x") && !isModelId("") && !isModelId("a b") && !isModelId("../x") && !isModelId("x".repeat(65)),
  );
  check("katalogda yo'q model — nomi ID, hamma darajalar", modelInfo("my-model").name === "my-model" && modelInfo("my-model").efforts.length === 4);
  check(
    "faqat Responses'da ishlaydiganlar — Astra va 6.1 Sol",
    AI_MODEL_CATALOG.filter((m) => m.responsesOnly).map((m) => m.id).sort().join() === "gpt-6-astra,gpt-6.1-sol",
  );

  const base = { models: null, defaultModel: null, defaultEffort: "low" };
  const resp = modelChoices({ model: "gpt-5.6", api: "responses" }, base);
  check(
    "sukut ro'yxat: .env modeli boshida + katalog (taxallussiz), sukut — .env modeli",
    resp.models[0].id === "gpt-5.6" && resp.models.length === AI_MODEL_CATALOG.filter((m) => !m.alias).length + 1 &&
      resp.defaultModel === "gpt-5.6" && resp.defaultEffort === "low" && resp.models[0].efforts.length === 4,
    JSON.stringify(resp.models.map((m) => m.id)),
  );
  const chat = modelChoices({ model: "gpt-5.6", api: "chat" }, base);
  check(
    "proksi (Chat Completions): Astra / 6.1 Sol yo'q, «Tezlik» tanlanmaydi",
    !chat.models.some((m) => m.id === "gpt-6-astra" || m.id === "gpt-6.1-sol") && chat.models.every((m) => m.efforts.length === 0) && chat.defaultEffort === null,
  );
  const avail = modelChoices({ model: "gpt-5.6", api: "responses" }, base, new Set(["gpt-6-sol", "gpt-6-luna"]));
  check(
    "hisobda yo'q model ko'rinmaydi, .env modeli qoladi",
    eq(avail.models.map((m) => m.id), ["gpt-5.6", "gpt-6-sol", "gpt-6-luna"]),
    JSON.stringify(avail.models.map((m) => m.id)),
  );
  const admin = modelChoices(
    { model: "gpt-5.6", api: "responses" },
    { models: ["gpt-6-astra", "gpt-6-luna"], defaultModel: "gpt-6-astra", defaultEffort: "none" },
  );
  check(
    "admin ro'yxati — aynan shu; sukut — admin tanlagani; «Tezkor» Astra'da «Tez» ga",
    eq(admin.models.map((m) => m.id), ["gpt-6-astra", "gpt-6-luna"]) && admin.defaultModel === "gpt-6-astra" && admin.defaultEffort === "low",
    JSON.stringify(admin),
  );
  check("xodim ro'yxatda yo'q modelni so'rasa — sukut model", resolveChoice(admin, "gpt-5.6-sol", "high").model === "gpt-6-astra");
  check("model qabul qilmaydigan daraja — eng yaqini", eq(resolveChoice(admin, "gpt-6-astra", "none"), { model: "gpt-6-astra", effort: "low" }));
  check("noto'g'ri daraja (max) — sukut daraja", eq(resolveChoice(admin, "gpt-6-luna", "max"), { model: "gpt-6-luna", effort: "low" }));
  check("proksi rejimida daraja yuborilmaydi", resolveChoice(chat, "gpt-6-sol", "high").effort === null);
  check("admin ro'yxati bo'sh bo'lmaydi: .env modeli birinchi", adminModelIds({ models: null }, "custom-x")[0] === "custom-x");

  // Qaysi API: OpenAI'ning o'zi — Responses, boshqa manzil (proksi) — Chat Completions.
  {
    const { aiProviderConfig } = await import("@/lib/ai/config");
    const names = ["OPENAI_URL_API", "OPENAI_BASE_URL", "AI_ASSISTANT_API"];
    const keep = Object.fromEntries(names.map((n) => [n, process.env[n]]));
    process.env.OPENAI_URL_API = "sk-test";
    delete process.env.OPENAI_BASE_URL;
    delete process.env.AI_ASSISTANT_API;
    const official = aiProviderConfig()?.api;
    process.env.OPENAI_BASE_URL = "https://proxy.example/v1/";
    const proxy = aiProviderConfig()?.api;
    process.env.AI_ASSISTANT_API = "responses";
    const forced = aiProviderConfig()?.api;
    for (const n of names) {
      if (keep[n] === undefined) delete process.env[n];
      else process.env[n] = keep[n];
    }
    check("API: OpenAI — Responses, proksi — Chat Completions, AI_ASSISTANT_API majburlaydi", official === "responses" && proxy === "chat" && forced === "responses", JSON.stringify({ official, proxy, forced }));
  }

  // Ekranda ko'rsatish: faqat ichki va xodim ocha oladigan sahifa.
  const cashier = { can: (p) => isPathAllowed(p, ["/finance-cash"]) };
  check("ekran: ruxsatli ichki sahifa", eq(screenOf(cashier, "/finance-cash"), { screen: "/finance-cash" }));
  check(
    "ekran: ruxsatsiz, tashqi, yo'q — ochilmaydi",
    eq(screenOf(cashier, "/finance-payroll"), {}) && eq(screenOf(cashier, "https://x.uz"), {}) && eq(screenOf(cashier, "//x.uz/a"), {}) &&
      eq(screenOf(cashier, "javascript:alert(1)"), {}) && eq(screenOf(cashier, undefined), {}),
  );

  // Responses oqimi.
  {
    const s = R.emptyResponseState();
    const texts = [
      { type: "response.created", response: { id: "resp_1", status: "in_progress", output: [] } },
      { type: "response.output_item.added", output_index: 0, item: { type: "reasoning", id: "rs_1" } },
      { type: "response.output_item.done", output_index: 0, item: { type: "reasoning", id: "rs_1", encrypted_content: "enc", summary: [] } },
      { type: "response.output_text.delta", item_id: "msg_1", output_index: 1, content_index: 0, delta: "Sa" },
      { type: "response.output_text.delta", item_id: "msg_1", output_index: 1, content_index: 0, delta: "lom" },
      { type: "response.function_call_arguments.delta", item_id: "fc_1", output_index: 2, delta: '{"to' },
      { type: "response.output_item.done", output_index: 2, item: { type: "function_call", id: "fc_1", call_id: "call_1", name: "crm_help", arguments: '{"topic":"lid"}' } },
    ].map((ev) => R.applyResponseEvent(s, ev));
    check("Responses: matn bo'laklari", s.content === "Salom" && eq(texts.filter(Boolean), ["Sa", "lom"]), JSON.stringify(s));
    check(
      "Responses: yakuniy hodisa kelmasa — tugagan elementlar (to'liq argument bilan)",
      R.itemsOf(s).length === 2 && eq(R.functionCallsOf(R.itemsOf(s)), [{ callId: "call_1", name: "crm_help", arguments: '{"topic":"lid"}' }]),
    );
    R.applyResponseEvent(s, {
      type: "response.completed",
      response: { status: "completed", output: [{ type: "message", id: "msg_1", content: [{ type: "output_text", text: "Salom" }] }] },
    });
    check("Responses: yakuniy ro'yxat ustun", s.status === "completed" && R.itemsOf(s).length === 1 && R.functionCallsOf(R.itemsOf(s)).length === 0);
  }
  {
    const failed = R.emptyResponseState();
    R.applyResponseEvent(failed, { type: "response.failed", response: { status: "failed", error: { code: "server_error", message: "boom" } } });
    const err = R.emptyResponseState();
    R.applyResponseEvent(err, { type: "error", code: "rate_limit", message: "rate limited" });
    check("Responses: xato hodisalari", failed.error === "boom" && err.error === "rate limited");
    const body = R.responseStateFromBody({
      id: "resp_2",
      status: "completed",
      error: null,
      output: [
        { type: "reasoning", id: "rs_2", encrypted_content: "e2", summary: [] },
        { type: "message", id: "msg_2", role: "assistant", content: [{ type: "output_text", text: "Bir " }, { type: "output_text", text: "yo'la" }] },
      ],
    });
    check("Responses: oqimsiz javob", body.content === "Bir yo'la" && body.error === null && body.status === "completed", JSON.stringify(body));
    check("Responses: oqimsiz xato tanasi", R.responseStateFromBody({ error: { message: "bad" } }).error === "bad");
  }
  {
    const sealed = [{ type: "reasoning", id: "rs_1", encrypted_content: "x" }, { type: "function_call", id: "fc_1", call_id: "c1", name: "a", arguments: "{}" }];
    check("qaytarish: shifrlangan fikrlash — o'zgarmaydi", eq(R.replayItems(sealed), sealed));
    const open = [{ type: "reasoning", id: "rs_1", summary: [] }, { type: "function_call", id: "fc_1", call_id: "c1", name: "a", arguments: "{}" }];
    check(
      "qaytarish: shifrsiz — fikrlash tashlanadi, id olinadi",
      eq(R.replayItems(open), [{ type: "function_call", call_id: "c1", name: "a", arguments: "{}" }]),
    );
    check("plainItems: oddiy xabarga tegmaydi", eq(R.plainItems([{ role: "user", content: "x" }]), [{ role: "user", content: "x" }]));
  }
}

// ── 5-bosqich: Cowork rejasi, istalgan ma'lumot, jadval, yangi amallar ──
console.log("\n— 5-bosqich (reja, query_data, jadval, guruh/davomat yordamchilari)");
{
  const { matchGroups, describeGroup, attendanceStatusOf, dmy } = await import("@/lib/ai/actions/prepareStudents");
  const { parsePlan } = await import("@/lib/ai/tools/plan");
  const { assertSafe, redact, isSecretKey, fieldSchema } = await import("@/lib/ai/tools/dataQuery");
  const { parseAiMarkdown: md, tableCells, tableCsv, plainText } = await import("@/components/ai/aiMarkdown");

  const groups = [
    { id: 101, name: "5", course: "Ingliz tili", level: "A1", teacher: "Dilnoza Karimova", day: "Toq kunlar", time: "14:00 - 16:00", status: "active" },
    { id: 102, name: "12", course: "Matematika", teacher: "Otabek Rasulov", day: "Juft kunlar", time: "10:00 - 12:00", status: "active" },
    { id: 103, name: "15", course: "Ingliz tili", level: "B1", teacher: "Dilnoza Karimova", day: "Juft kunlar", time: "16:00 - 18:00", status: "archive" },
  ];
  const ids = (q) => matchGroups(groups, q).map((g) => g.id);
  check("guruh: raqam / '5-guruh' / '#12' — nomi bo'yicha", eq(ids("5"), [101]) && eq(ids("5-guruh"), [101]) && eq(ids("#12"), [102]));
  check("guruh: kurs + ustoz so'zlari (guruh/ustoz so'zlari e'tiborsiz)", eq(ids("ingliz dilnoza ustozning guruhi"), [101, 103]) && eq(ids("matematika"), [102]));
  check("guruh: kurs + daraja aniqlaydi, mos kelmasa bo'sh", eq(ids("ingliz b1"), [103]) && eq(ids("kimyo"), []));
  check("guruh tavsifi", describeGroup(groups[0]) === "Ingliz tili (5-guruh) · Dilnoza Karimova · Toq kunlar 14:00 - 16:00", describeGroup(groups[0]));
  check(
    "davomat holati: kalit, yorliq, sinonim; noma'lumi — null",
    attendanceStatusOf("keldi") === "keldi" && attendanceStatusOf("Sababsiz") === "sababsiz" && attendanceStatusOf("kelmadi") === "sababsiz" &&
      attendanceStatusOf("Birinchi dars") === "birinchi" && attendanceStatusOf("bilmadim") === null,
  );
  check("sana ko'rinishi", dmy("2026-10-08") === "08.10.2026");

  check(
    "reja: qadamlar, noma'lum holat — pending, matn kesiladi",
    eq(parsePlan([{ title: " To'lovlarni olish ", status: "active" }, { title: "Xulosa", status: "?" }]), [
      { title: "To'lovlarni olish", status: "active" },
      { title: "Xulosa", status: "pending" },
    ]),
  );
  check(
    "reja: bo'sh, sarlavhasiz va 8 tadan ko'p — rad",
    throwsInput(() => parsePlan([])) && throwsInput(() => parsePlan([{ status: "done" }])) &&
      throwsInput(() => parsePlan(Array.from({ length: 9 }, (_, i) => ({ title: `q${i}`, status: "pending" })))),
  );
  {
    const r = await runTool({ can: () => true, actions: false, isAdmin: false, permissions: ["/groups"] }, "update_plan", JSON.stringify({ steps: [{ title: "A", status: "done" }] }));
    check("update_plan: panelga reja, modelga faqat ok (_ui ketmaydi)", r.ok && eq(r.plan, [{ title: "A", status: "done" }]) && r.content === '{"ok":true}', JSON.stringify(r));
  }

  const rejects = (q) => throwsInput(() => assertSafe(q));
  check(
    "query_data: JS va yozuv operatorlari rad etiladi",
    rejects({ $where: "1" }) && rejects([{ $match: { $expr: { $function: { body: "x" } } } }]) && rejects([{ $merge: "pupils" }]) && rejects([{ $out: "x" }]),
  );
  check(
    "query_data: $lookup faqat oq ro'yxatga",
    rejects([{ $lookup: { from: "users", localField: "a", foreignField: "b", as: "u" } }]) &&
      !throwsInput(() => assertSafe([{ $lookup: { from: "pupils", localField: "pupilId", foreignField: "id", as: "p" } }])) &&
      rejects([{ $unionWith: "user_sessions" }]),
  );
  check(
    "sir kalitlar: parol, xesh, token o'chadi; 'passed' kabi maydon qoladi",
    isSecretKey("studentPasswordHash") && isSecretKey("access_token") && isSecretKey("tgChatId") && !isSecretKey("passed") && !isSecretKey("phone"),
  );
  {
    const r = redact({
      _id: "x",
      id: 7,
      phone: "94 155 88 55",
      parentPasswordHash: "h",
      phones: ["+998941558855", "998931112233"],
      nested: { motherPhone: "+998931112233", note: "a".repeat(400) },
    });
    check(
      "redact: sirlar yo'q, guruh kaliti (_id) qoladi, telefonlar (ro'yxati ham) yashirin, uzun matn qisqa",
      eq(Object.keys(r), ["_id", "id", "phone", "phones", "nested"]) &&
        r._id === "x" &&
        r.phone === "94 *** ** 55" &&
        r.phones.every((p) => p.includes("***")) &&
        r.nested.motherPhone.includes("***") &&
        r.nested.note.length <= 301,
      JSON.stringify(r).slice(0, 200),
    );
    const oid = redact({ _id: { toHexString: () => "65f0aa" }, id: 1 });
    check("redact: hujjatning ObjectId'si chiqmaydi (kaliti ham)", eq(Object.keys(oid), ["id"]), JSON.stringify(oid));
    check(
      "query_data: sir maydonga murojaat (taxallus, $$ROOT, $getField, filtr) rad etiladi",
      rejects([{ $project: { h: "$studentPasswordHash" } }]) &&
        rejects([{ $project: { kv: { $objectToArray: "$$ROOT" } } }]) &&
        rejects([{ $replaceWith: "$$ROOT" }]) &&
        rejects({ studentPasswordHash: { $regex: "^\\$2a" } }) &&
        rejects([{ $project: { x: { $getField: "parentPasswordHash" } } }]) &&
        rejects([{ $project: { m: { $map: { input: "$kids", in: "$$this.passwordHash" } } } }]),
    );
    check(
      "query_data: telefon ifodada va qism bo'yicha qidiruvda rad; nomi bilan va bo'sh/bor-yo'qligi — mumkin",
      rejects([{ $group: { _id: "$groupId", phones: { $push: "$phone" } } }]) &&
        rejects({ phone: { $regex: "^99894" } }) &&
        rejects({ "parents.fatherPhone": { $gt: "9989" } }) &&
        !throwsInput(() => assertSafe({ phone: "" })) &&
        !throwsInput(() => assertSafe({ phone: { $exists: true } })) &&
        !throwsInput(() => assertSafe([{ $project: { firstName: 1, phone: 1 } }])) &&
        !throwsInput(() => assertSafe([{ $group: { _id: "$teacherName", total: { $sum: "$amount" } } }])),
    );
    const s = fieldSchema([{ id: 1, phone: "94 155 88 55", tags: [] }, { id: 2, phone: null, tags: ["a"] }]);
    check("describe: maydon turi va yashirin namuna", s.id.type === "number" && s.id.seenIn === 2 && s.phone.example === "94 *** ** 55" && s.tags.type === "array", JSON.stringify(s));
  }

  const t1 = md("Bugungi to'lovlar:\n\n| O'quvchi | Summa |\n|---|---:|\n| **Ali** | 300 000 |\n| Vali \\| Akbar | 150 000 |\n\nJami: 2 ta");
  check(
    "markdown jadval: sarlavha, qatorlar, \\| katak ichida, atrofdagi matn",
    t1.length === 3 && t1[1].kind === "table" && eq(t1[1].header, ["O'quvchi", "Summa"]) && eq(t1[1].rows, [["**Ali**", "300 000"], ["Vali | Akbar", "150 000"]]) &&
      t1[0].kind === "p" && t1[2].kind === "p",
    JSON.stringify(t1),
  );
  check("jadval qatori sarlavha kengligiga keltiriladi", eq(md("| a | b | c |\n|--|--|--|\n| 1 |")[0].rows, [["1", "", ""]]));
  check("katak matni belgilarsiz", plainText("**Ali** [profil](/student-edit/1?src=list)") === "Ali profil" && eq(tableCells("|a|b\\|c|"), ["a", "b|c"]));
  {
    const csv = tableCsv(["Ism", "Izoh"], [["**Ali**", 'dedi: "ha"; keyin']]);
    check("CSV: BOM, ';' ajratkich, qo'shtirnoq qochiriladi", csv.startsWith("﻿") && csv.includes("Ism;Izoh") && csv.includes('Ali;"dedi: ""ha""; keyin"'), JSON.stringify(csv));
  }
}

// ── 6-bosqich: MohiraAI — genie animatsiyasi, suhbatlar tarixi, nom ────
console.log("\n— 6-bosqich (genie kadrlari, suhbatlar tarixi, MohiraAI)");
{
  const { genieSide, genieFrames, GENIE_POINTS } = await import("@/components/ai/genie");
  const { groupHistory, touchHistory, historyTitle, filterHistory } = await import("@/components/ai/history");
  const { ASSISTANT_NAME } = await import("@/lib/ai/brand");
  const { systemPrompt } = await import("@/lib/ai/prompt");

  const screen = { x: 0, y: 0, w: 1440, h: 900 };
  const fab = { x: 16, y: 756, w: 56, h: 56 }; // standart joy: chap-past
  const float = { x: 1016, y: 296, w: 400, h: 580 };
  check(
    "genie: tomon — to'liq ekrandan pastga, suzuvchi oynadan chapga, yon/tepa tugmaga o'shanga",
    genieSide(screen, fab) === "bottom" && genieSide(float, fab) === "left" &&
      genieSide(screen, { x: 1376, y: 420, w: 56, h: 56 }) === "right" && genieSide(screen, { x: 700, y: 8, w: 56, h: 56 }) === "top",
  );

  /** clip-path ko'pburchagining nuqtalari va chegarasi. */
  const pts = (clip) => [...clip.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const bounds = (p) => ({
    x0: Math.min(...p.map((q) => q[0])),
    x1: Math.max(...p.map((q) => q[0])),
    y0: Math.min(...p.map((q) => q[1])),
    y1: Math.max(...p.map((q) => q[1])),
  });
  const near = (a, b) => Math.abs(a - b) <= 0.15;
  for (const [name, win] of [["to'liq ekran", screen], ["suzuvchi oyna", float]]) {
    const fr = genieFrames(win, fab);
    const counts = new Set(fr.map((f) => pts(f.clip).length));
    check(`genie (${name}): kadrlar 0→1, nuqtalar soni bir xil`, fr.length === 29 && fr[0].offset === 0 && fr[28].offset === 1 &&
      fr.every((f, i) => i === 0 || f.offset > fr[i - 1].offset) && counts.size === 1 && [...counts][0] === 2 * GENIE_POINTS && GENIE_POINTS >= 48, `${fr.length} ${[...counts]}`);
    const first = fr[0];
    const b0 = bounds(pts(first.clip));
    check(`genie (${name}): boshida oyna o'z joyida`, first.transform === "translate(0px, 0px) scale(1, 1)" && first.opacity === 1 &&
      near(b0.x0, win.x) && near(b0.x1, win.x + win.w) && near(b0.y0, win.y) && near(b0.y1, win.y + win.h), `${first.transform} ${JSON.stringify(b0)}`);
    const last = fr[28];
    const b1 = bounds(pts(last.clip));
    const m = last.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+), ([\d.]+)\)/);
    check(
      `genie (${name}): oxirida tugma ichida, ko'rinmas`,
      last.opacity === 0 && !!m && near(Number(m[1]), fab.x - win.x) && near(Number(m[2]), fab.y - win.y) &&
        Math.abs(Number(m[3]) - fab.w / win.w) < 1e-3 && Math.abs(Number(m[4]) - fab.h / win.h) < 1e-3 &&
        near(b1.x0, fab.x) && near(b1.x1, fab.x + fab.w) && near(b1.y0, fab.y) && near(b1.y1, fab.y + fab.h),
      `${last.transform} ${JSON.stringify(b1)}`,
    );
  }
  {
    // Tugma oyna o'rtasida — g'alati holat ham son bersin (NaN emas).
    const fr = genieFrames(screen, { x: 692, y: 422, w: 56, h: 56 });
    check("genie: tugma oyna o'rtasida — NaN yo'q", fr.every((f) => !/NaN|Infinity/.test(f.clip + f.transform + f.opacity)));
  }

  const now = new Date(2026, 9, 8, 15, 0); // mahalliy vaqt — sinov soat mintaqasiga bog'liq emas
  const at = (d, h) => new Date(2026, 9, d, h).toISOString();
  const items = [
    { id: "a", title: "Bugungi to'lovlar", updatedAt: at(8, 10) },
    { id: "b", title: "Qarzdorlar", updatedAt: at(7, 23) },
    { id: "c", title: "Davomat", updatedAt: at(4, 9) },
    { id: "d", title: "Oylik", updatedAt: at(1, 9) },
    { id: "e", title: "Eski", updatedAt: new Date(2026, 7, 20).toISOString() },
  ];
  const g = groupHistory(items, now);
  check(
    "tarix: Bugun / Kecha / 7 kun / 30 kun / oldinroq",
    eq(g.map((x) => [x.group, x.items.map((i) => i.id)]), [["today", ["a"]], ["yesterday", ["b"]], ["week", ["c"]], ["month", ["d"]], ["older", ["e"]]]),
    JSON.stringify(g.map((x) => [x.group, x.items.map((i) => i.id)])),
  );
  check("tarix: bo'sh guruh chiqmaydi", eq(groupHistory([items[2], items[0]], now).map((x) => x.group), ["today", "week"]));
  check("tarix: nom — server kabi (bo'shliqlar yig'iladi, 80 belgi)", historyTitle("  Bugun\n kim   to'ladi?  ") === "Bugun kim to'ladi?" && historyTitle("x".repeat(90)).length === 80);
  {
    const list = items.slice(0, 2);
    const added = touchHistory(list, "z", "Yangi  savol", at(8, 14));
    const moved = touchHistory(list, "b", "boshqa savol", at(8, 14));
    check(
      "tarix: yangi suhbat tepaga qo'shiladi, eskisi tepaga chiqadi (nomi o'zgarmaydi)",
      eq(added.map((x) => x.id), ["z", "a", "b"]) && added[0].title === "Yangi savol" &&
        eq(moved.map((x) => x.id), ["b", "a"]) && moved[0].title === "Qarzdorlar" && moved[0].updatedAt === at(8, 14) &&
        touchHistory(null, "z", "q", at(8, 14)) === null,
    );
  }
  check("tarix qidiruvi: katta-kichik harf va apostrof turlari", eq(filterHistory([{ title: "Bugungi TO‘LOVLAR" }, { title: "Davomat" }], "to'lov").map((x) => x.title), ["Bugungi TO‘LOVLAR"]));

  check("nom: MohirAI (09.10 dan, «Mohira emas — Mohir»)", ASSISTANT_NAME === "MohirAI");
  check("ko'rsatma: yordamchi o'zini MohirAI deb taniydi", systemPrompt({ today: "2026-10-08", branchName: "Markaz", userName: "X", isAdmin: false, actions: false }, "uz").includes("You are MohirAI (Mohir)"));
  {
    // Adminga samimiyroq: ba'zan «afandim / shefim / boss»; oddiy xodimga — yo'q.
    const p = (isAdmin) => systemPrompt({ today: "2026-10-09", branchName: "Markaz", userName: "X", isAdmin, actions: false }, "uz");
    check(
      "ko'rsatma: adminga ba'zan «afandim, shefim, boss», xodimga emas",
      ["afandim", "shefim", "boss", "never in two answers in a row"].every((w) => p(true).includes(w)) && !p(false).includes("afandim") && !p(false).includes("TONE"),
    );
  }
}

// ── Model ↔ vositalar sikli (soxta OpenAI serveri) ─────────────────────
// Tarmoqqa chiqmaydi: 127.0.0.1 da OpenAI kabi javob beradigan kichik
// server. Sinaladi: so'rov shakli, bo'laklab kelgan vosita chaqiruvi,
// natijaning modelga qaytishi, ruxsat, chegaralar, xato kodlari, oqimsiz
// javob, xodim "To'xtatish" ni bosishi. Faqat bazaga tegmaydigan
// `crm_help` chaqiriladi.
console.log("\n— runChatTurn (soxta OpenAI)");
const { createServer } = await import("node:http");
const { runChatTurn } = await import("@/lib/ai/chat");
const { MAX_ROUNDS, HISTORY_MESSAGES } = await import("@/lib/ai/config");
const { adminDetail, AiProviderError, PROVIDER_ERRORS } = await import("@/lib/ai/openai");
const { toolLabel } = await import("@/lib/ai/toolLabels");

/** Joriy ssenariy: (so'rov tanasi, tartib raqami) → javob. */
let reply = () => ({ status: 500, json: {} });
const seen = [];
const server = createServer(async (req, res) => {
  let raw = "";
  for await (const part of req) raw += part;
  const body = JSON.parse(raw || "{}");
  seen.push({ path: req.url, auth: req.headers.authorization, body });
  const r = reply(body, seen.length);
  if (!r.sse) {
    res.writeHead(r.status ?? 200, { "content-type": "application/json" });
    res.end(JSON.stringify(r.json));
    return;
  }
  res.writeHead(200, { "content-type": "text/event-stream" });
  // 7 baytdan yoziladi — qator ham, ko'p baytli harf ham bo'linib kelsin.
  const bytes = Buffer.from(r.sse.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + (r.hold ? "" : "data: [DONE]\n\n"));
  for (let i = 0; i < bytes.length; i += 7) res.write(bytes.subarray(i, i + 7));
  if (!r.hold) res.end(); // `hold` — ulanish ochiq qoladi (model "o'ylayapti")
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const cfg = { apiKey: "sk-test-123", baseUrl: `http://127.0.0.1:${server.address().port}/v1`, model: "fake-model" };

const textChunks = (...parts) => [
  ...parts.map((content, i) => ({ choices: [{ index: 0, delta: i ? { content } : { role: "assistant", content } }] })),
  { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
];
/** OpenAI kabi: avval id va nom, keyin argument bo'laklari. */
function callChunks(calls, content = "") {
  const out = content ? [{ choices: [{ index: 0, delta: { role: "assistant", content } }] }] : [];
  calls.forEach((c, index) => {
    out.push({ choices: [{ index: 0, delta: { tool_calls: [{ index, id: c.id, type: "function", function: { name: c.name, arguments: "" } }] } }] });
    const args = JSON.stringify(c.args ?? {});
    for (let i = 0; i < args.length; i += 5) {
      out.push({ choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: args.slice(i, i + 5) } }] } }] });
    }
  });
  out.push({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] });
  return out;
}
const chatCtx = (perms) => ({
  db: null,
  userId: "u1",
  userName: "Sinov Xodim",
  employeeName: "",
  isAdmin: perms === null,
  permissions: perms,
  scope: { branchId: 1, allowed: [1] },
  branchName: "Markaz",
  today: "2026-10-07",
  can: (href) => isPathAllowed(href, perms),
  actions: false,
});
async function turn(ctx, question, { history = [], signal = new AbortController().signal, onEvent, conf = cfg, effort } = {}) {
  const events = [];
  seen.length = 0;
  const started = Date.now();
  const emit = (e) => {
    events.push(e);
    onEvent?.(e);
  };
  try {
    const r = await runChatTurn({ ctx, cfg: conf, lang: "uz", history, question, emit, signal, effort });
    return { ...r, events, ms: Date.now() - started };
  } catch (error) {
    return { error, events, ms: Date.now() - started };
  }
}
const deltas = (r) => r.events.filter((e) => e.type === "delta").map((e) => e.text);

{
  const question = "Lid qanday qo'shiladi?";
  reply = (_, n) =>
    n === 1
      ? { sse: callChunks([{ id: "call_1", name: "crm_help", args: { topic: question } }]) }
      : { sse: textChunks("Lid qo'shish uchun ", "[Lidlar](/orders-list) sahifasini oching. Салом ✓") };
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `eski ${i}`, at: "" }));
  const r = await turn(chatCtx(["/orders-list"]), question, { history });
  const [q1, q2] = seen.map((s) => s.body);
  check(
    "so'rov: manzil, kalit, model, oqim; ortiqcha maydon yo'q",
    seen[0]?.path === "/v1/chat/completions" && seen[0]?.auth === "Bearer sk-test-123" && q1?.model === "fake-model" &&
      q1?.stream === true && !("temperature" in q1) && !("max_tokens" in q1) && !("stream_options" in q1) && !("reasoning_effort" in q1),
    JSON.stringify(seen[0] ?? r.error?.logDetail ?? null).slice(0, 300),
  );
  const offered = (q1?.tools ?? []).map((x) => x.function.name).sort();
  // staff_tasks — /tasks hammaga ochiq (oddiy xodim faqat o'z topshiriqlarini ko'radi).
  check("modelga faqat ruxsat etilgan vositalar beriladi", eq(offered, ["crm_help", "leads_summary", "overview", "staff_tasks", "update_plan"]), JSON.stringify(offered));
  const msgs = q1?.messages ?? [];
  check(
    `tarix: tizim ko'rsatmasi + oxirgi ${HISTORY_MESSAGES} xabar + savol`,
    msgs.length === HISTORY_MESSAGES + 2 && msgs[0].role === "system" && msgs[0].content.includes("2026-10-07") &&
      msgs[0].content.includes("Markaz") && msgs[1].content === `eski ${20 - HISTORY_MESSAGES}` && msgs.at(-1).role === "user" &&
      msgs.at(-1).content === question,
    JSON.stringify(msgs.map((m) => m.content.slice(0, 20))),
  );
  const asked = q2?.messages.find((m) => m.role === "assistant" && m.tool_calls);
  const answered = q2?.messages.find((m) => m.role === "tool");
  check(
    "bo'laklangan argumentlar yig'ildi, natija o'sha id bilan qaytdi",
    asked?.tool_calls[0]?.function.arguments === JSON.stringify({ topic: question }) && answered?.tool_call_id === "call_1" &&
      JSON.parse(answered.content).sections?.[0]?.title === "Lid qo'shish",
    JSON.stringify({ asked, answered: answered?.content.slice(0, 120) }),
  );
  const answer = "Lid qo'shish uchun [Lidlar](/orders-list) sahifasini oching. Салом ✓";
  check("javob bo'laklab oqdi (ko'p baytli harflar buzilmadi)", r.answer === answer && deltas(r).join("") === answer, JSON.stringify(r.answer ?? r.error?.logDetail));
  check(
    "vosita hodisalari: start → done, yorliq bilan",
    eq(r.events.filter((e) => e.type === "tool"), [
      { type: "tool", id: "call_1", label: toolLabel("crm_help"), status: "start" },
      { type: "tool", id: "call_1", label: toolLabel("crm_help"), status: "done" },
    ]) && eq(r.usedTools, ["crm_help"]),
    JSON.stringify(r.events.filter((e) => e.type === "tool")),
  );
}
{
  reply = (_, n) =>
    n === 1
      ? { sse: callChunks([{ id: "c1", name: "payroll_summary", args: {} }], "Tekshiraman.") }
      : { sse: textChunks("Bu ma'lumot ruxsatingizdan tashqarida.") };
  const r = await turn(chatCtx(["/groups"]), "Oylik qancha?");
  const msgs = seen[1]?.body.messages ?? [];
  check(
    "ro'yxatda yo'q vosita so'ralsa — bajarilmaydi, modelga 'no access'",
    msgs.find((m) => m.role === "tool")?.content.includes("no access") &&
      r.events.some((e) => e.type === "tool" && e.status === "error"),
    JSON.stringify(msgs.at(-1)),
  );
  check(
    "murojaatlar matni bo'sh qator bilan ajraladi",
    r.answer === "Tekshiraman.\n\nBu ma'lumot ruxsatingizdan tashqarida." && msgs.find((m) => m.role === "assistant")?.content === "Tekshiraman.",
    JSON.stringify(r.answer),
  );
}
{
  const calls = Array.from({ length: 6 }, (_, i) => ({ id: `k${i}`, name: "crm_help", args: { topic: "davomat" } }));
  reply = (_, n) => (n === 1 ? { sse: callChunks(calls) } : { sse: textChunks("Tayyor.") });
  const r = await turn(chatCtx(null), "Hammasini ayt");
  const results = (seen[1]?.body.messages ?? []).filter((m) => m.role === "tool");
  check(
    "bir qadamda 4 tadan ortiq vosita bajarilmaydi (har chaqiruvga javob bor)",
    results.length === 6 && results.slice(4).every((m) => m.content.includes("At most 4")) && r.usedTools.length === 4 &&
      r.events.filter((e) => e.type === "tool" && e.status === "start").length === 4,
    JSON.stringify({ results: results.length, used: r.usedTools.length }),
  );
  const biggest = Math.max(...results.slice(0, 4).map((m) => m.content.length));
  check("admin uchun crm_help natijasi chegaraga sig'adi (kesilmaydi)", !results[0]?.content.includes('"truncated"'), `${biggest} belgi`);
}
{
  reply = (body) =>
    body.tools ? { sse: callChunks([{ id: `r${seen.length}`, name: "crm_help", args: { topic: "parol" } }]) } : { sse: textChunks("Yakuniy javob.") };
  const r = await turn(chatCtx(null), "Aylanib qol");
  check(
    `model to'xtamasa: ${MAX_ROUNDS} murojaat, oxirgisida vosita berilmaydi`,
    seen.length === MAX_ROUNDS && seen.slice(0, -1).every((s) => Array.isArray(s.body.tools)) && !("tools" in seen.at(-1).body) &&
      r.answer === "Yakuniy javob." && r.usedTools.length === MAX_ROUNDS - 1,
    JSON.stringify({ requests: seen.length, answer: r.answer, error: r.error?.logDetail }),
  );
}
{
  reply = () => ({ json: { choices: [{ index: 0, message: { role: "assistant", content: "Proksi orqali javob." }, finish_reason: "stop" }] } });
  const r = await turn(chatCtx(null), "Salom");
  check("oqimsiz (JSON) javob ham o'qiladi", r.answer === "Proksi orqali javob." && eq(deltas(r), ["Proksi orqali javob."]), JSON.stringify(r.answer ?? r.error?.logDetail));
}
for (const [status, text] of [
  [401, PROVIDER_ERRORS.auth.message],
  [404, PROVIDER_ERRORS.model.message],
  [429, PROVIDER_ERRORS.busy.message],
  [503, PROVIDER_ERRORS.down.message],
  [400, PROVIDER_ERRORS.rejected.message],
]) {
  reply = () => ({ status, json: { error: { message: "Incorrect API key provided: sk-test-123" } } });
  const r = await turn(chatCtx(null), "Salom");
  check(
    `HTTP ${status} → xodimga tushunarli xabar, tafsilot faqat jurnalda`,
    r.error instanceof AiProviderError && r.error.message === text && !r.error.message.includes("sk-") && r.error.logDetail.includes(`HTTP ${status}`),
    String(r.error?.message ?? r.answer),
  );
}
{
  // OpenAI yangi modellarda tashkilot tasdiqlanmagan bo'lsa oqimni rad etadi
  // (400, param "stream") — oqimsiz so'rov o'tadi, vositalar sikli ham ishlaydi.
  const refusal = {
    status: 400,
    json: {
      error: {
        message: "Your organization must be verified to stream this model. Please go to: https://platform.openai.com/settings/organization/general and click on Verify Organization.",
        type: "invalid_request_error",
        param: "stream",
        code: "unsupported_value",
      },
    },
  };
  const message = (m) => ({ json: { choices: [{ index: 0, message: { role: "assistant", ...m }, finish_reason: m.tool_calls ? "tool_calls" : "stop" }] } });
  const call = { id: "ns1", type: "function", function: { name: "crm_help", arguments: JSON.stringify({ topic: "lid" }) } };
  let streamed = 0;
  reply = (body) => {
    if (body.stream) {
      streamed++;
      return refusal;
    }
    return body.messages.some((m) => m.role === "tool") ? message({ content: "Oqimsiz javob." }) : message({ content: null, tool_calls: [call] });
  };
  const conf = { ...cfg, model: "verify-needed-model" };
  const r = await turn(chatCtx(null), "Lid qanday qo'shiladi?", { conf });
  check(
    "oqim rad etilsa — oqimsiz qayta so'raladi, vosita sikli ishlaydi",
    r.answer === "Oqimsiz javob." && eq(seen.map((s) => s.body.stream), [true, false, false]) && eq(r.usedTools, ["crm_help"]),
    JSON.stringify({ stream: seen.map((s) => s.body.stream), answer: r.answer, error: r.error?.logDetail }),
  );
  const again = await turn(chatCtx(null), "Yana", { conf });
  check(
    "keyingi savolda shu model darhol oqimsiz (rad etilgan so'rov takrorlanmaydi)",
    streamed === 1 && seen.length >= 1 && seen.every((s) => s.body.stream === false),
    JSON.stringify({ streamed, stream: seen.map((s) => s.body.stream), error: again.error?.logDetail }),
  );
  reply = () => ({ status: 400, json: { error: { message: "Invalid schema for function 'x'", param: "tools" } } });
  const other = await turn(chatCtx(null), "Salom", { conf: { ...cfg, model: "other-400-model" } });
  check(
    "boshqa 400 xatoda qayta so'ralmaydi",
    other.error instanceof AiProviderError && other.error.message === PROVIDER_ERRORS.rejected.message && seen.length === 1,
    JSON.stringify({ requests: seen.length, error: other.error?.logDetail }),
  );
  const shown = adminDetail("HTTP 401 (m): Incorrect API key provided: sk-proj-abc1234567890***wxyz. See docs.");
  check("admin tafsilotida kalit yashiriladi", shown.includes("HTTP 401") && !/sk-proj-abc|wxyz/.test(shown), shown);
}
{
  // gpt-5.6 (sinov saytida ko'rilgan haqiqiy javob): vositalar faqat
  // `reasoning_effort: "none"` bilan. Eski modellarga bu maydon yuborilmaydi.
  const effortRefusal = {
    status: 400,
    json: {
      error: {
        message:
          "Function tools with reasoning_effort are not supported for gpt-5.6 in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'.",
        type: "invalid_request_error",
        param: null,
        code: null,
      },
    },
  };
  const effortOk = (body) => !body.tools || body.reasoning_effort === "none";
  reply = (body, n) => {
    if (!effortOk(body)) return effortRefusal;
    return body.messages.some((m) => m.role === "tool")
      ? { sse: textChunks("Bugun 3 ta lid.") }
      : { sse: callChunks([{ id: `e${n}`, name: "crm_help", args: { topic: "lid" } }]) };
  };
  const conf = { ...cfg, model: "effort-model" };
  const r = await turn(chatCtx(null), "Bugungi lidlar", { conf });
  check(
    "reasoning_effort rad etilsa — \"none\" bilan qayta so'raladi, javob oqimda keladi",
    r.answer === "Bugun 3 ta lid." &&
      eq(seen.map((s) => s.body.reasoning_effort ?? "—"), ["—", "none", "none"]) &&
      seen.every((s) => s.body.stream === true) &&
      deltas(r).join("") === "Bugun 3 ta lid." &&
      eq(r.usedTools, ["crm_help"]),
    JSON.stringify({ effort: seen.map((s) => s.body.reasoning_effort ?? "—"), answer: r.answer, error: r.error?.logDetail }),
  );
  const again = await turn(chatCtx(null), "Yana", { conf });
  check(
    "keyingi savolda \"none\" darhol yuboriladi (rad javobi takrorlanmaydi)",
    again.answer === "Bugun 3 ta lid." && seen.every((s) => s.body.reasoning_effort === "none"),
    JSON.stringify({ effort: seen.map((s) => s.body.reasoning_effort ?? "—"), error: again.error?.logDetail }),
  );

  // Ikkalasi birga: avval reasoning_effort, keyin oqim rad etiladi.
  reply = (body) => {
    if (!effortOk(body)) return effortRefusal;
    if (body.stream) return { status: 400, json: { error: { message: "Your organization must be verified to stream this model.", param: "stream" } } };
    return { json: { choices: [{ index: 0, message: { role: "assistant", content: "Ikkalasi bilan javob." }, finish_reason: "stop" }] } };
  };
  const both = await turn(chatCtx(null), "Salom", { conf: { ...cfg, model: "both-quirks-model" } });
  check(
    "ikkala moslashuv ketma-ket qo'llanadi (3 so'rov), javob keladi",
    both.answer === "Ikkalasi bilan javob." &&
      eq(seen.map((s) => [s.body.reasoning_effort ?? "—", s.body.stream]), [["—", true], ["none", true], ["none", false]]),
    JSON.stringify({ reqs: seen.map((s) => [s.body.reasoning_effort ?? "—", s.body.stream]), error: both.error?.logDetail }),
  );
}
{
  reply = () => ({ sse: [{ error: { message: "server_error" } }] });
  const r = await turn(chatCtx(null), "Salom");
  check("oqim ichidagi xato", r.error instanceof AiProviderError && r.error.message === PROVIDER_ERRORS.down.message, String(r.error?.message ?? r.answer));
  const n = await turn(chatCtx(null), "Salom", { conf: { ...cfg, baseUrl: "http://127.0.0.1:1/v1" } });
  check("xizmatga ulanib bo'lmasa", n.error instanceof AiProviderError && n.error.message === PROVIDER_ERRORS.network.message, String(n.error?.message ?? n.answer));
}
{
  // Xodim "To'xtatish" ni bosdi: birinchi bo'lak kelgach ulanish uziladi,
  // model esa hali "yozmoqda" (javob tugamagan).
  reply = () => ({ sse: [{ choices: [{ index: 0, delta: { role: "assistant", content: "Bir" } }] }], hold: true });
  const stop = new AbortController();
  const r = await turn(chatCtx(null), "Salom", { signal: stop.signal, onEvent: (e) => e.type === "delta" && stop.abort() });
  check("to'xtatilganda kutib qolmaydi", r.ms < 5000 && eq(deltas(r), ["Bir"]), `${r.ms} ms, ${String(r.error?.logDetail ?? r.answer)}`);
}

// ── 4-bosqich: Responses API (soxta server) ──────────────────────────
// OpenAI'ning o'zi bilan shu yo'l ishlaydi (lib/ai/config.ts → api).
console.log("\n— runChatTurn: Responses API (soxta OpenAI)");
const rcfg = { ...cfg, api: "responses", model: "fake-responses" };
const rText = (...parts) => [
  ...parts.map((delta) => ({ type: "response.output_text.delta", item_id: "msg_x", output_index: 0, content_index: 0, delta })),
  {
    type: "response.completed",
    response: {
      status: "completed",
      output: [{ type: "message", id: "msg_x", role: "assistant", status: "completed", content: [{ type: "output_text", text: parts.join(""), annotations: [] }] }],
    },
  },
];
/** Fikrlash (shifrlangan) + vosita chaqiruvlari — OpenAI kabi. */
function rCalls(calls) {
  const items = [
    { type: "reasoning", id: "rs_A", summary: [], encrypted_content: "ENC_A" },
    ...calls.map((c) => ({ type: "function_call", id: `fc_${c.id}`, call_id: c.id, name: c.name, arguments: JSON.stringify(c.args ?? {}), status: "completed" })),
  ];
  return [
    ...items.map((item, output_index) => ({ type: "response.output_item.done", output_index, item })),
    { type: "response.completed", response: { status: "completed", output: items } },
  ];
}
{
  const question = "Lid qanday qo'shiladi?";
  reply = (_, n) =>
    n === 1 ? { sse: rCalls([{ id: "call_r1", name: "crm_help", args: { topic: question } }]) } : { sse: rText("Lidlar ", "[sahifasida](/orders-list).") };
  const history = [
    { role: "user", content: "oldin", at: "" },
    { role: "assistant", content: "javob", at: "" },
  ];
  const r = await turn(chatCtx(["/orders-list"]), question, { history, conf: rcfg, effort: "medium" });
  const [q1, q2] = seen.map((s) => s.body);
  check(
    "Responses so'rovi: manzil, model, store:false, oqim, daraja, ortiqcha maydon yo'q",
    seen[0]?.path === "/v1/responses" && q1?.model === "fake-responses" && q1.store === false && q1.stream === true &&
      eq(q1.reasoning, { effort: "medium" }) && q1.tool_choice === "auto" && typeof q1.instructions === "string" && q1.instructions.includes("2026-10-07") &&
      !("temperature" in q1) && !("max_output_tokens" in q1) && !("include" in q1) && !("messages" in q1),
    JSON.stringify(q1 ?? r.error?.logDetail ?? null).slice(0, 300),
  );
  check(
    "input: tarix + savol (tizim ko'rsatmasi — instructions'da)",
    eq(q1?.input, [
      { role: "user", content: "oldin" },
      { role: "assistant", content: "javob" },
      { role: "user", content: question },
    ]),
    JSON.stringify(q1?.input),
  );
  const tools = q1?.tools ?? [];
  check(
    "vositalar: tekis shakl, strict:false, faqat ruxsat etilganlari",
    tools.length > 0 && tools.every((x) => x.type === "function" && x.strict === false && x.name && x.parameters && !("function" in x)) &&
      eq(tools.map((x) => x.name).sort(), ["crm_help", "leads_summary", "overview", "staff_tasks", "update_plan"]),
    JSON.stringify(tools.map((x) => x.name)),
  );
  const input2 = q2?.input ?? [];
  const out = input2.find((it) => it.type === "function_call_output");
  check(
    "2-murojaat: fikrlash va chaqiruv o'zgarmay qaytadi, natija call_id bilan",
    input2.length === 6 && eq(input2[3], { type: "reasoning", id: "rs_A", summary: [], encrypted_content: "ENC_A" }) &&
      input2[4]?.type === "function_call" && input2[4].id === "fc_call_r1" && out?.call_id === "call_r1" &&
      JSON.parse(out.output).sections?.[0]?.title === "Lid qo'shish",
    JSON.stringify(input2).slice(0, 400),
  );
  check(
    "javob oqimda, vosita hodisalari start → done",
    r.answer === "Lidlar [sahifasida](/orders-list)." && deltas(r).join("") === r.answer &&
      eq(r.events.filter((e) => e.type === "tool").map((e) => [e.id, e.status]), [["call_r1", "start"], ["call_r1", "done"]]),
    JSON.stringify({ answer: r.answer, error: r.error?.logDetail }),
  );
}
{
  reply = (body) =>
    body.tool_choice === "auto" ? { sse: rCalls([{ id: `k${seen.length}`, name: "crm_help", args: { topic: "parol" } }]) } : { sse: rText("Yakuniy.") };
  const r = await turn(chatCtx(null), "Aylanib qol", { conf: rcfg });
  check(
    `Responses: ${MAX_ROUNDS} murojaat, oxirgisida tool_choice "none" (ro'yxat turadi)`,
    seen.length === MAX_ROUNDS && seen.at(-1).body.tool_choice === "none" && Array.isArray(seen.at(-1).body.tools) && r.answer === "Yakuniy.",
    JSON.stringify({ n: seen.length, last: seen.at(-1)?.body.tool_choice, error: r.error?.logDetail }),
  );
  check("daraja berilmasa — reasoning yuborilmaydi", seen.every((s) => !("reasoning" in s.body)));
}
{
  const refusal = {
    status: 400,
    json: {
      error: {
        message: "Unsupported value: 'none' is not supported with the 'gpt-6-astra' model. Supported values are: 'low', 'medium', 'high', 'xhigh', and 'max'.",
        type: "invalid_request_error",
        param: "reasoning.effort",
        code: "unsupported_value",
      },
    },
  };
  reply = (body) => (body.reasoning?.effort === "none" ? refusal : { sse: rText("Tayyor.") });
  const conf = { ...rcfg, model: "astra-like" };
  const r = await turn(chatCtx(null), "Salom", { conf, effort: "none" });
  check(
    "daraja rad etilsa — OpenAI sanagan eng yaqini (low) bilan qayta",
    r.answer === "Tayyor." && eq(seen.map((s) => s.body.reasoning?.effort), ["none", "low"]),
    JSON.stringify({ e: seen.map((s) => s.body.reasoning?.effort), error: r.error?.logDetail }),
  );
  const again = await turn(chatCtx(null), "Yana", { conf, effort: "none" });
  check("keyingi savolda darhol «low» (rad javobi takrorlanmaydi)", again.answer === "Tayyor." && eq(seen.map((s) => s.body.reasoning?.effort), ["low"]));
  const high = await turn(chatCtx(null), "Chuqur", { conf, effort: "high" });
  check("boshqa daraja o'z holicha", high.answer === "Tayyor." && eq(seen.map((s) => s.body.reasoning?.effort), ["high"]));
}
{
  reply = (body) =>
    body.reasoning
      ? { status: 400, json: { error: { message: "Unsupported parameter: 'reasoning.effort' is not supported with this model.", param: "reasoning.effort", code: "unsupported_parameter" } } }
      : { sse: rText("Oddiy model.") };
  const r = await turn(chatCtx(null), "Salom", { conf: { ...rcfg, model: "plain-model" }, effort: "low" });
  check("fikrlamaydigan model — reasoning'siz qayta so'raladi", r.answer === "Oddiy model." && seen.length === 2 && !("reasoning" in seen[1].body), JSON.stringify(r.error?.logDetail ?? null));
}
{
  // Tashkilot tasdiqlanmagan: oqim rad etiladi — JSON javob, vosita sikli ham ishlaydi.
  const json = (output) => ({ json: { id: "resp", status: "completed", error: null, output } });
  reply = (body) => {
    if (body.stream) return { status: 400, json: { error: { message: "Your organization must be verified to stream this model.", param: "stream", code: "unsupported_value" } } };
    return body.input.some((it) => it.type === "function_call_output")
      ? json([{ type: "message", id: "m1", role: "assistant", content: [{ type: "output_text", text: "Oqimsiz javob." }] }])
      : json([
          { type: "reasoning", id: "rs9", encrypted_content: "E9", summary: [] },
          { type: "function_call", id: "fc9", call_id: "c9", name: "crm_help", arguments: '{"topic":"lid"}' },
        ]);
  };
  const r = await turn(chatCtx(null), "Lid?", { conf: { ...rcfg, model: "verify-model-r" }, effort: "low" });
  check(
    "Responses: oqim rad etilsa — oqimsiz, vosita sikli ishlaydi",
    r.answer === "Oqimsiz javob." && eq(seen.map((s) => s.body.stream), [true, false, false]) && eq(r.usedTools, ["crm_help"]) &&
      seen[2].body.input.some((it) => it.type === "reasoning" && it.encrypted_content === "E9"),
    JSON.stringify({ stream: seen.map((s) => s.body.stream), answer: r.answer, error: r.error?.logDetail }),
  );
}
{
  // Zaxira: OpenAI oldingi elementlarni qabul qilmasa — fikrlashsiz, id siz qayta.
  reply = (body) => {
    if (body.input.some((it) => it.type === "reasoning")) {
      return { status: 400, json: { error: { message: "Item with id 'rs_A' not found. Items are not persisted when `store` is set to false.", param: "input", code: null } } };
    }
    return body.input.some((it) => it.type === "function_call_output")
      ? { sse: rText("Fikrlashsiz davom.") }
      : { sse: rCalls([{ id: "p1", name: "crm_help", args: { topic: "lid" } }]) };
  };
  const r = await turn(chatCtx(null), "Lid?", { conf: { ...rcfg, model: "plain-input-model" } });
  const last = seen.at(-1)?.body.input ?? [];
  check(
    "oldingi elementlar rad etilsa — fikrlashsiz, id siz qayta yuboriladi",
    r.answer === "Fikrlashsiz davom." && seen.length === 3 && !last.some((it) => it.type === "reasoning" || "id" in it) &&
      last.some((it) => it.type === "function_call" && it.call_id === "p1"),
    JSON.stringify({ n: seen.length, error: r.error?.logDetail }),
  );
}
{
  reply = () => ({ sse: [{ type: "response.failed", response: { status: "failed", error: { code: "server_error", message: "boom" } } }] });
  const r = await turn(chatCtx(null), "Salom", { conf: rcfg });
  check(
    "Responses: oqimdagi xato — xodimga umumiy xabar, tafsilot jurnalda",
    r.error instanceof AiProviderError && r.error.message === PROVIDER_ERRORS.down.message && r.error.logDetail.includes("boom"),
    String(r.error?.logDetail ?? r.answer),
  );
}
{
  const { accountModels } = await import("@/lib/ai/openai");
  reply = () => ({ json: { object: "list", data: [{ id: "gpt-6-sol", object: "model" }, { id: "gpt-6-luna", object: "model" }] } });
  seen.length = 0;
  const ids = await accountModels(cfg);
  const again = await accountModels(cfg);
  check(
    "hisobdagi modellar: GET /v1/models, eslab qolinadi",
    ids?.has("gpt-6-sol") && ids.size === 2 && again === ids && seen.length === 1 && seen[0].path === "/v1/models" && seen[0].auth === "Bearer sk-test-123",
    JSON.stringify({ ids: ids ? [...ids] : null, n: seen.length }),
  );
  check("ro'yxatni olib bo'lmasa — null (tekshirilmaydi)", (await accountModels({ ...cfg, baseUrl: "http://127.0.0.1:1/v1" })) === null);
}
{
  // 5-bosqich (Cowork): model reja yozadi va bir qadamda bir nechta vosita chaqiradi.
  console.log("\n— runChatTurn: reja (update_plan)");
  const steps = [
    { title: "Qo'llanmani ko'rish", status: "active" },
    { title: "Javob yozish", status: "pending" },
  ];
  reply = (_, n) =>
    n === 1
      ? {
          sse: callChunks([
            { id: "p1", name: "update_plan", args: { steps } },
            { id: "h1", name: "crm_help", args: { topic: "lid" } },
            ...Array.from({ length: 4 }, (_, i) => ({ id: `x${i}`, name: "crm_help", args: { topic: "parol" } })),
          ]),
        }
      : { sse: textChunks("Tayyor.") };
  const r = await turn(chatCtx(null), "Lid va parol haqida");
  const plans = r.events.filter((e) => e.type === "plan");
  const toolEvents = r.events.filter((e) => e.type === "tool");
  const results = (seen[1]?.body.messages ?? []).filter((m) => m.role === "tool");
  check(
    "reja: panelga plan hodisasi, update_plan uchun vosita belgisi yo'q",
    plans.length === 1 && eq(plans[0].steps, steps) && !toolEvents.some((e) => e.id === "p1") && toolEvents.length === 8,
    JSON.stringify({ plans: plans.length, tools: toolEvents.map((e) => `${e.id}:${e.status}`) }),
  );
  check(
    "reja vositalar chegarasiga kirmaydi: 4 ta vosita bajarildi, 5-chisi rad",
    results.length === 6 && results.filter((m) => m.content.includes("At most 4")).length === 1 && r.usedTools.filter((x) => x !== "update_plan").length === 4,
    JSON.stringify({ results: results.length, used: r.usedTools }),
  );
}
server.closeAllConnections();
server.close();

// ── 09.10.2026 ko'rib chiqish tuzatishlari (bazasiz qismi) ───────────
console.log("\n— Ko'rib chiqish tuzatishlari (qoralama kaliti, ogohlantirish tarjimasi)");
{
  const { draftSubject } = await import("@/lib/ai/actions/store");
  const a = draftSubject("kirim", { cashboxId: 4, studentId: 12, amount: 300000, method: "naqd", category: "Kurs to'lovi", periodMonth: "2026-10" });
  const b = draftSubject("kirim", { cashboxId: 4, studentId: 12, amount: 350000, method: "plastik", category: "Kurs to'lovi", periodMonth: "2026-09" });
  const c = draftSubject("kirim", { cashboxId: 4, studentId: 13, amount: 300000, category: "Kurs to'lovi" });
  check("qoralama kaliti: summa/oy/to'lov turi o'zgarsa — o'sha amal; boshqa o'quvchi — boshqa amal", a === b && a !== c, JSON.stringify({ a, b, c }));
  check(
    "qoralama kaliti: davomat — guruh + kun; yangi o'quvchi — telefon raqamlari; topshiriq — xodimlar tartibsiz",
    draftSubject("attendance", { groupId: 5, date: "2026-10-09", marks: [] }) === "attendance|5|2026-10-09" &&
      draftSubject("pupil", { values: { phone: "+998 94 155 88 55", firstName: "Ali" } }) === "pupil|998941558855" &&
      draftSubject("task", { employeeIds: [9, 3] }) === draftSubject("task", { employeeIds: [3, 9] }),
  );
}
{
  const { translate } = await import("@/lib/i18n");
  const paidLater = translate("en", "Oktyabr oyida bu oy qoldig'idan 180 000 so'm berilgan bo'lishi mumkin — qayta bermang, avval o'sha yozuvni tekshiring.");
  const saved = translate("en", "Shu amal 09.10.2026 | 14:05 da allaqachon saqlangan (#708) — ikkinchi marta yozilmasin.");
  check(
    "kartadagi qizil ogohlantirishlar inglizchaga o'giriladi (teskari moslash)",
    paidLater.startsWith("Up to") && paidLater.includes("October") && saved.startsWith("This operation was already saved") && saved.includes("#708"),
    JSON.stringify({ paidLater, saved }),
  );
}

console.log(bad ? `\n${bad} ta tekshiruv o'tmadi.` : "\nHammasi to'g'ri.");
process.exit(bad ? 1 : 0);
