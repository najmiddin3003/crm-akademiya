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
const toolsFor = (perms, actions = false) =>
  AI_TOOLS.filter((tool) => toolAllowed(tool, (href) => isPathAllowed(href, perms), actions)).map((tool) => tool.name).sort();
check("admin / cheklovsiz — o'qish vositalari hammasi", toolsFor(null).length === AI_TOOLS.filter((x) => !x.action).length);
check("amallar yoqilsa — admin uchun hammasi", toolsFor(null, true).length === AI_TOOLS.length);
check(
  "amallar: kassa ruxsati — kirim/chiqim, lid emas",
  eq(toolsFor(["/finance-cash"], true).filter((n) => n.startsWith("propose") || n === "action_options"), ["action_options", "propose_chiqim", "propose_kirim"]),
  JSON.stringify(toolsFor(["/finance-cash"], true)),
);
check("amallar o'chiq — amal vositasi ko'rinmaydi", !toolsFor(null, false).some((n) => n.startsWith("propose")));
check(
  "faqat Guruh ruxsati — guruhlar + umumiylar",
  eq(toolsFor(["/groups"]), ["crm_help", "list_groups", "overview"]),
  JSON.stringify(toolsFor(["/groups"])),
);
check(
  "Lidlar + O'quvchilar",
  eq(toolsFor(["/orders-list", "/students-list"]), ["crm_help", "leads_summary", "overview", "pupil_details", "search_pupils"]),
  JSON.stringify(toolsFor(["/orders-list", "/students-list"])),
);
check("Kassa ruxsati oylikni ochmaydi", !toolsFor(["/finance-cash"]).includes("payroll_summary") && toolsFor(["/finance-cash"]).includes("cashbox_balances"));
check("Moliya hisobotlari — finance_summary", toolsFor(["/finance-reports"]).includes("finance_summary"));
check("har vositaning yorlig'i bor", AI_TOOLS.every((tool) => TOOL_LABELS.some((x) => x.name === tool.name)));

const fakeCtx = (perms, actions = false) => ({ can: (href) => isPathAllowed(href, perms), actions });
{
  const r = await runTool(fakeCtx(["/groups"]), "payroll_summary", "{}");
  check("ruxsatsiz vosita bajarilmaydi", !r.ok && r.content.includes("no access"), r.content);
  const off = await runTool(fakeCtx(null, false), "propose_kirim", "{}");
  check("amallar o'chiq — amal vositasi bajarilmaydi", !off.ok && off.content.includes("turned off"), off.content);
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
  "sukut — o'chiq (amallar ham)",
  eq(normalizeAiSettings(null), { enabled: false, actionsEnabled: false, dailyLimit: DEFAULT_DAILY_LIMIT, updatedBy: null, updatedAt: null }),
);
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
const { AiProviderError, PROVIDER_ERRORS } = await import("@/lib/ai/openai");
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
async function turn(ctx, question, { history = [], signal = new AbortController().signal, onEvent, conf = cfg } = {}) {
  const events = [];
  seen.length = 0;
  const started = Date.now();
  const emit = (e) => {
    events.push(e);
    onEvent?.(e);
  };
  try {
    const r = await runChatTurn({ ctx, cfg: conf, lang: "uz", history, question, emit, signal });
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
      q1?.stream === true && !("temperature" in q1) && !("max_tokens" in q1) && !("stream_options" in q1),
    JSON.stringify(seen[0] ?? r.error?.logDetail ?? null).slice(0, 300),
  );
  const offered = (q1?.tools ?? []).map((x) => x.function.name).sort();
  check("modelga faqat ruxsat etilgan vositalar beriladi", eq(offered, ["crm_help", "leads_summary", "overview"]), JSON.stringify(offered));
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
server.closeAllConnections();
server.close();

console.log(bad ? `\n${bad} ta tekshiruv o'tmadi.` : "\nHammasi to'g'ri.");
process.exit(bad ? 1 : 0);
