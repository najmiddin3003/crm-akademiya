// AI SUHBATINI QAYTA O'YNASH — haqiqiy model + haqiqiy vositalar (11.10.2026).
//
//   AI_DEBUG_TOOLS=1 node --env-file=.env.local --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_replay-ai-chat.mjs
//
// 10.10.2026 dagi savollar (lib/ai/tools/payroll.ts izohi) bir suhbat bo'lib
// beriladi: oldingi javoblar tarixga qo'shiladi, ya'ni «barcha filiallar
// uchun yarat» kabi davom savollari ham sinaladi. Baza — .env.local dagi
// (Atlas ko'zgusi); model — OPENAI_URL_API / OPENAI_MODEL. HECH NARSA
// YOZILMAYDI: amallar o'chiq (`actions: false`), suhbat saqlanmaydi.
import fs from "node:fs";

if (!process.env.MONGODB_URI) {
  console.log("MONGODB_URI yo'q (.env.local)");
  process.exit(1);
}
const { getDb } = await import("@/lib/mongodb");
const { aiProviderConfig } = await import("@/lib/ai/config");
const { runChatTurn } = await import("@/lib/ai/chat");
const { collapseBranchPools } = await import("@/lib/branchPools");
const { isPathAllowed } = await import("@/lib/permissions");

const cfg = aiProviderConfig();
if (!cfg) {
  console.log("AI sozlanmagan (OPENAI_URL_API)");
  process.exit(1);
}
const db = await getDb();
const all = (await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray()).map((b) => ({
  id: Number(b.id),
  name: String(b.name),
}));
const today = process.env.AI_TODAY || new Date().toISOString().slice(0, 10);

function ctxFor(branchId, isAdmin, allowedIds, userName) {
  const allowed = isAdmin ? all.map((b) => b.id) : allowedIds;
  return {
    db,
    userId: "replay",
    userName,
    employeeName: isAdmin ? "" : userName,
    employeeId: null,
    isAdmin,
    permissions: null,
    scope: { branchId, allowed, isAdmin },
    branchName: all.find((b) => b.id === branchId)?.name ?? `#${branchId}`,
    branches: collapseBranchPools(all.filter((b) => allowed.includes(b.id)), branchId),
    today,
    can: (href) => isPathAllowed(href, null),
    actions: false,
    startedAt: new Date(),
  };
}

const SCRIPTS = [
  {
    who: "Admin (navbar: Uychi)",
    ctx: ctxFor(3, true, [], "Abdulloh Raxmatullayev"),
    questions: [
      "Shu oyda kirim va chiqim qancha bo'ldi?",
      "Ustozlar qancha avans olgan",
      "barcha filiallar uchun yarat",
      "har bir ustoz qancha avans olganini ko'rmoqchiman",
      "bugungi holat bo'yicha qancha oylik chiqyapti barcha xodimlarga",
      "barcha filiallarga nisbatan hisobla",
    ],
  },
  {
    who: "Kassir (Chortoq)",
    ctx: ctxFor(1, false, [1], "Nilufar Sharipova"),
    questions: ["Eng katta qarzdor o'quvchilar kimlar?"],
  },
];

const only = process.env.ONLY ? Number(process.env.ONLY) : null;
let out = "";
const log = (s) => {
  out += `${s}\n`;
  console.log(s);
};

for (const sc of SCRIPTS) {
  log(`\n################ ${sc.who}`);
  const history = [];
  let qi = 0;
  for (const q of sc.questions) {
    qi++;
    if (only !== null && qi !== only && sc.who.startsWith("Admin")) {
      history.push({ role: "user", content: q, at: new Date().toISOString() });
      continue;
    }
    log(`\n=== SAVOL: ${q}`);
    const tools = [];
    const started = Date.now();
    const res = await runChatTurn({
      ctx: sc.ctx,
      cfg,
      lang: "uz",
      history: [...history],
      question: q,
      emit: (e) => {
        if (e.type === "tool" && e.status !== "start") tools.push(`${e.label}${e.note ? ` (${e.note})` : ""}`);
      },
      signal: new AbortController().signal,
    }).catch((e) => ({ answer: `XATO: ${e?.message ?? e}`, usedTools: [] }));
    const notes = tools.length ? `\n    ${tools.join("\n    ")}` : "";
    log(`--- vositalar: ${res.usedTools.join(", ") || "—"} | ${Math.round((Date.now() - started) / 1000)} s${notes}`);
    log(`--- JAVOB:\n${res.answer}`);
    history.push({ role: "user", content: q, at: new Date().toISOString() });
    history.push({ role: "assistant", content: res.answer, at: new Date().toISOString() });
  }
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, out, "utf8");
process.exit(0);
