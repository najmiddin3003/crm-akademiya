// FILIALLAR UCHUN TELEGRAM TOPIKLARI — lidlar ("Lidlar" guruhi) va to'lovlar
// (to'lovlar guruhi). Har filialga o'z topigi; lib/leadNotify.ts va
// lib/sync/dispatch.ts xabarni shunga qarab yo'naltiradi.
//
//   node scripts/telegram-branch-topics.mjs [--leads | --payments | --attendance]   holat (sukut --leads; hech narsa o'zgarmaydi)
//   … --create          topigi yo'q har filial uchun guruhda topik OCHADI va bazaga yozadi
//   … --set 3 45        3-filialga 45-topikni biriktiradi (raqam yoki topik havolasi; 0 — olib tashlash)
//   … --test            har biriktirilgan topikka bittadan sinov xabari
//   … --payments --cashbox 7 4    7-kassani 4-filialga biriktiradi — to'lov topigi KASSA filialidan aniqlanadi
//
// OQIMLAR: --leads → branches.leadTopicId, guruh TELEGRAM_CHAT_LEADS, topik nomi = filial nomi
//          --payments → branches.paymentTopicId, guruh TELEGRAM_CHAT_PAYMENTS, topik nomi = "<filial> to'lovlari"
//          --attendance → branches.attendanceTopicId (kechikish xabari, lib/attendanceNotify.ts),
//                         guruh TELEGRAM_CHAT_ATTENDANCE (bo'lmasa TELEGRAM_CHAT_PAYMENTS), topik nomi = "<filial> davomati"
//
// QAYERDA ISHGA TUSHIRILADI: baza yozuvi MONGODB_URI ga ketadi. Prod bazasi
// SERVERDA (lokal .env.local Atlas ko'zgusiga qaraydi):
//   ssh root@189.74.98.20 'cd /var/www/crm/current && sudo -u crm node scripts/telegram-branch-topics.mjs --payments --create'
//
// --create SHARTI: guruhda "Topics" yoqilgan, bot guruhda ADMIN va
// "Manage Topics" huquqi bilan. Topik nomini keyin Telegram'da bemalol
// o'zgartirsa bo'ladi — raqam o'zgarmaydi.
//
// NEGA BOT OCHADI: Bot API topiklar RO'YXATINI bermaydi, webhook o'rnatilgani
// uchun getUpdates ham yopiq (409). Qo'lda ochilgan topikning raqamini faqat
// "Copy Link" bilan topish mumkin (u ham ishlaydi: --set yoki Boshqaruv →
// Filiallar sahifasi havolani tushunadi). Bot o'zi ochsa raqam javobda
// keladi va darrov bazaga yoziladi — ko'chirishda xato bo'lmaydi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Loyihaning TS modulini to'g'ridan-to'g'ri import qilish (scripts/_ts-alias.mjs
// bilan bir xil yechim) — havola/raqam tahlili sahifa bilan BIR JOYDA tursin.
register("./_ts-alias-hooks.mjs", import.meta.url);
const { parseLeadTopicId } = await import("@/lib/managementBranches");

const envPath = path.join(HERE, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const KINDS = {
  leads: {
    label: "LIDLAR",
    field: "leadTopicId",
    chat: "TELEGRAM_CHAT_LEADS",
    fallback: "TELEGRAM_TOPIC_LEADS",
    topicName: (b) => b.name,
    fallbackNote: "topigi yo'q filialning lidi YUBORILMAYDI",
    test: (b) => `🔧 Sinov: <b>${b.name}</b> filialining yangi lidlari shu topikka tushadi.`,
  },
  payments: {
    label: "TO'LOVLAR",
    field: "paymentTopicId",
    chat: "TELEGRAM_CHAT_PAYMENTS",
    fallback: "TELEGRAM_TOPIC_PAYMENTS",
    topicName: (b) => `${b.name} to'lovlari`,
    fallbackNote: "topigi yo'q filialning to'lovi umumiy oqimga tushadi",
    test: (b) => `🔧 Sinov: <b>${b.name}</b> kassalariga tushgan to'lovlar shu topikka tushadi.`,
  },
  attendance: {
    label: "DAVOMAT",
    field: "attendanceTopicId",
    chat: "TELEGRAM_CHAT_ATTENDANCE",
    // Alohida guruh ochilmagan bo'lsa — to'lovlar guruhidagi topik (lib/attendanceNotify.ts bilan bir xil).
    chatFallback: "TELEGRAM_CHAT_PAYMENTS",
    fallback: "TELEGRAM_TOPIC_ATTENDANCE",
    topicName: (b) => `${b.name} davomati`,
    fallbackNote: "topigi yo'q filialning kechikish xabari YUBORILMAYDI",
    test: (b) => `🔧 Sinov: <b>${b.name}</b> filialida kechikkan xodimlar haqidagi xabar shu topikka tushadi.`,
  },
};
const kind = args.includes("--attendance") ? KINDS.attendance : args.includes("--payments") ? KINDS.payments : KINDS.leads;
const mode = args.includes("--create") ? "create"
  : args.includes("--test") ? "test"
  : args.includes("--set") ? "set"
  : args.includes("--cashbox") ? "cashbox"
  : "status";

const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env[kind.chat] || "").trim() || (kind.chatFallback ? (process.env[kind.chatFallback] || "").trim() : "");
const fallbackTopic = (process.env[kind.fallback] || "").trim();
const mongoUri = (process.env.MONGODB_URI || "").trim();
const dbName = (process.env.MONGODB_DB || "").trim() || "crm_akademiya";

const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
if (!mongoUri) fail("MONGODB_URI topilmadi (.env.local)");
if (mode === "create" || mode === "test") {
  if (!token) fail("TELEGRAM_BOT_TOKEN topilmadi (.env.local)");
  if (!chatId) fail(`${kind.chat} bo'sh — guruh id'sini yozing (-100… bilan boshlanadi)`);
}

const tg = async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
};

const client = new MongoClient(mongoUri);
await client.connect();
const db = client.db(dbName);
const col = db.collection("branches");
const loadBranches = () => col.find({}, { projection: { _id: 0, id: 1, name: 1, [kind.field]: 1 } }).sort({ id: 1 }).toArray();
const topicOf = (b) => b[kind.field];

const printStatus = async () => {
  const rows = await loadBranches();
  console.log(`${kind.label} — guruh (${kind.chat}): ${chatId || "(bo'sh)"}`);
  console.log(`Umumiy topik (${kind.fallback}): ${fallbackTopic || `(bo'sh — ${kind.fallbackNote})`}\n`);
  console.log("FILIALLAR:");
  for (const b of rows) {
    const t = topicOf(b) ? `topik ${topicOf(b)}` : fallbackTopic ? `(yo'q → umumiy ${fallbackTopic})` : `(YO'Q — ${kind.fallbackNote})`;
    console.log(`  ${String(b.id).padStart(2)}  ${b.name.padEnd(28)} ${t}`);
  }
  if (kind === KINDS.payments) {
    // To'lov topigi KASSA filialidan aniqlanadi — filialsiz kassa ko'rinib tursin.
    const boxes = await db.collection("cashboxes").find({}, { projection: { _id: 0, id: 1, name: 1, branchId: 1, isPrimary: 1, archived: 1 } }).sort({ id: 1 }).toArray();
    const byId = new Map(rows.map((b) => [b.id, b]));
    console.log("\nKASSALAR (to'lov qaysi filial topigiga tushadi):");
    for (const c of boxes) {
      const b = typeof c.branchId === "number" ? byId.get(c.branchId) : null;
      const where = !b ? "FILIAL YO'Q → umumiy topik   (--cashbox <kassa> <filial> bilan biriktiring)"
        : topicOf(b) ? `${b.name} → topik ${topicOf(b)}` : `${b.name} → (topik yo'q → umumiy)`;
      console.log(`  ${String(c.id).padStart(2)}  ${String(c.name).padEnd(34)} ${c.isPrimary ? "[bosh] " : ""}${c.archived ? "[arxiv] " : ""}${where}`);
    }
  }
};

try {
  if (mode === "status") await printStatus();

  if (mode === "set") {
    const i = args.indexOf("--set");
    const branchId = Number(args[i + 1]);
    const raw = args[i + 2];
    if (!Number.isInteger(branchId) || raw === undefined) fail("Foydalanish: --set <filial id> <topik raqami | havola | 0>");
    const parsed = parseLeadTopicId(raw);
    if (!parsed.ok) fail(parsed.error);
    const res = await col.updateOne(
      { id: branchId },
      parsed.value === null ? { $unset: { [kind.field]: 1 } } : { $set: { [kind.field]: parsed.value } },
    );
    if (res.matchedCount === 0) fail(`Filial ${branchId} topilmadi`);
    console.log(parsed.value === null ? `Filial ${branchId}: ${kind.label} topigi olib tashlandi\n` : `Filial ${branchId}: ${kind.label} topigi ${parsed.value}\n`);
    await printStatus();
  }

  if (mode === "cashbox") {
    const i = args.indexOf("--cashbox");
    const boxId = Number(args[i + 1]);
    const branchId = Number(args[i + 2]);
    if (!Number.isInteger(boxId) || !Number.isInteger(branchId)) fail("Foydalanish: --cashbox <kassa id> <filial id>");
    const branch = await col.findOne({ id: branchId }, { projection: { name: 1 } });
    if (!branch) fail(`Filial ${branchId} topilmadi`);
    const res = await db.collection("cashboxes").updateOne({ id: boxId }, { $set: { branchId } });
    if (res.matchedCount === 0) fail(`Kassa ${boxId} topilmadi`);
    console.log(`Kassa ${boxId} → ${branch.name} (filial ${branchId})\n`);
    await printStatus();
  }

  if (mode === "create") {
    const me = await tg("getMe");
    if (!me.ok) fail(`getMe: ${me.description}`);
    const chat = await tg("getChat", { chat_id: chatId });
    if (!chat.ok) fail(`getChat: ${chat.description} — bot guruhga qo'shilganmi, id to'g'rimi?`);
    if (!chat.result.is_forum) {
      fail(`"${chat.result.title}" guruhida Topics YOQILMAGAN — guruh sozlamalarida "Topics" ni yoqing, keyin qayta urinib ko'ring`);
    }
    const member = await tg("getChatMember", { chat_id: chatId, user_id: me.result.id });
    const st = member.ok ? member.result : null;
    if (!st || st.status !== "administrator" || !st.can_manage_topics) {
      fail(`@${me.result.username} "${chat.result.title}" da admin emas yoki "Manage Topics" huquqi yo'q`);
    }
    console.log(`Bot @${me.result.username} → "${chat.result.title}" (${kind.label})\n`);

    let made = 0;
    for (const b of await loadBranches()) {
      if (topicOf(b)) {
        console.log(`  ${b.name}: allaqachon topik ${topicOf(b)} — o'tkazib yuborildi`);
        continue;
      }
      const t = await tg("createForumTopic", { chat_id: chatId, name: kind.topicName(b).slice(0, 128) });
      if (!t.ok) {
        console.log(`  ${b.name}: OCHILMADI — ${t.description}`);
        continue;
      }
      const topicId = t.result.message_thread_id;
      await col.updateOne({ id: b.id }, { $set: { [kind.field]: topicId } });
      console.log(`  ${b.name}: topik ${topicId} ("${kind.topicName(b)}") ochildi va bazaga yozildi`);
      made++;
    }
    console.log(`\n${made} ta topik ochildi.\n`);
    await printStatus();
    if (made > 0) console.log("\nEslatma: ilova filial hujjatini har xabarda bazadan o'qiydi — qayta ishga tushirish shart emas.");
  }

  if (mode === "test") {
    const rows = (await loadBranches()).filter((b) => topicOf(b));
    if (rows.length === 0) fail("Birorta filialga topik biriktirilmagan — avval --create yoki --set");
    for (const b of rows) {
      const r = await tg("sendMessage", { chat_id: chatId, message_thread_id: topicOf(b), parse_mode: "HTML", text: kind.test(b) });
      console.log(`  ${b.name} → topik ${topicOf(b)}: ${r.ok ? "✅ yetib bordi" : `❌ ${r.description}`}`);
    }
  }
} finally {
  await client.close();
}
