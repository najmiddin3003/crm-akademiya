// FILIAL LIDLARI UCHUN TELEGRAM TOPIKLARI — "Lidlar" guruhida har filialga
// o'z topigi; lib/leadNotify.ts yangi lidni shunga qarab yo'naltiradi.
//
//   node scripts/telegram-lead-topics.mjs              holat: filiallar va topiklari (hech narsa o'zgarmaydi)
//   node scripts/telegram-lead-topics.mjs --create     topigi yo'q har filial uchun guruhda topik OCHADI va bazaga yozadi
//   node scripts/telegram-lead-topics.mjs --set 3 45   3-filialga 45-topikni biriktiradi (raqam yoki topik havolasi; 0 — olib tashlash)
//   node scripts/telegram-lead-topics.mjs --test       har biriktirilgan topikka bittadan sinov xabari yuboradi
//
// KERAKLI SOZLAMA (.env.local): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_LEADS
// (lidlar guruhining id'si, -100… bilan boshlanadi), MONGODB_URI.
//
// QAYERDA ISHGA TUSHIRILADI: baza yozuvi MONGODB_URI ga ketadi. Prod bazasi
// SERVERDA (lokal .env.local Atlas ko'zgusiga qaraydi) — prod uchun
// serverda yurgiziladi:
//   ssh root@189.74.98.20 'sudo -iu crm bash -c "cd /var/www/crm/current && node scripts/telegram-lead-topics.mjs --create"'
//
// --create SHARTI: guruhda "Topics" yoqilgan, bot guruhda ADMIN va
// "Manage Topics" huquqi bilan. Topik nomi = filial nomi; keyin Telegram'da
// bemalol o'zgartirsa bo'ladi — raqam o'zgarmaydi.
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

const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_LEADS || "").trim();
const fallbackTopic = (process.env.TELEGRAM_TOPIC_LEADS || "").trim();
const mongoUri = (process.env.MONGODB_URI || "").trim();
const dbName = (process.env.MONGODB_DB || "").trim() || "crm_akademiya";

const args = process.argv.slice(2);
const mode = args.includes("--create") ? "create" : args.includes("--test") ? "test" : args.includes("--set") ? "set" : "status";

const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
if (!mongoUri) fail("MONGODB_URI topilmadi (.env.local)");
if (mode !== "status" && mode !== "set") {
  if (!token) fail("TELEGRAM_BOT_TOKEN topilmadi (.env.local)");
  if (!chatId) fail("TELEGRAM_CHAT_LEADS bo'sh — lidlar guruhining id'sini yozing (-100… bilan boshlanadi)");
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
const col = client.db(dbName).collection("branches");
const loadBranches = () => col.find({}, { projection: { _id: 0, id: 1, name: 1, leadTopicId: 1 } }).sort({ id: 1 }).toArray();

const printStatus = (rows) => {
  console.log(`Guruh (TELEGRAM_CHAT_LEADS): ${chatId || "(bo'sh)"}`);
  console.log(`Umumiy topik (TELEGRAM_TOPIC_LEADS): ${fallbackTopic || "(bo'sh — topigi yo'q filialning lidi YUBORILMAYDI)"}\n`);
  console.log("FILIALLAR:");
  for (const b of rows) {
    const t = b.leadTopicId ? `topik ${b.leadTopicId}` : fallbackTopic ? `(yo'q → umumiy ${fallbackTopic})` : "(YO'Q — lid yuborilmaydi)";
    console.log(`  ${String(b.id).padStart(2)}  ${b.name.padEnd(28)} ${t}`);
  }
};

try {
  if (mode === "status") {
    printStatus(await loadBranches());
  }

  if (mode === "set") {
    const i = args.indexOf("--set");
    const branchId = Number(args[i + 1]);
    const raw = args[i + 2];
    if (!Number.isInteger(branchId) || raw === undefined) fail("Foydalanish: --set <filial id> <topik raqami | havola | 0>");
    const parsed = parseLeadTopicId(raw);
    if (!parsed.ok) fail(parsed.error);
    const res = await col.updateOne(
      { id: branchId },
      parsed.value === null ? { $unset: { leadTopicId: 1 } } : { $set: { leadTopicId: parsed.value } },
    );
    if (res.matchedCount === 0) fail(`Filial ${branchId} topilmadi`);
    console.log(parsed.value === null ? `Filial ${branchId}: topik olib tashlandi` : `Filial ${branchId}: topik ${parsed.value}`);
    console.log();
    printStatus(await loadBranches());
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
    console.log(`Bot @${me.result.username} → "${chat.result.title}"\n`);

    const rows = await loadBranches();
    let made = 0;
    for (const b of rows) {
      if (b.leadTopicId) {
        console.log(`  ${b.name}: allaqachon topik ${b.leadTopicId} — o'tkazib yuborildi`);
        continue;
      }
      const t = await tg("createForumTopic", { chat_id: chatId, name: b.name.slice(0, 128) });
      if (!t.ok) {
        console.log(`  ${b.name}: OCHILMADI — ${t.description}`);
        continue;
      }
      const topicId = t.result.message_thread_id;
      await col.updateOne({ id: b.id }, { $set: { leadTopicId: topicId } });
      console.log(`  ${b.name}: topik ${topicId} ochildi va bazaga yozildi`);
      made++;
    }
    console.log(`\n${made} ta topik ochildi.\n`);
    printStatus(await loadBranches());
    if (made > 0) {
      console.log("\nEslatma: ilova filial hujjatini har lidda bazadan o'qiydi — qayta ishga tushirish shart emas.");
    }
  }

  if (mode === "test") {
    const rows = (await loadBranches()).filter((b) => b.leadTopicId);
    if (rows.length === 0) fail("Birorta filialga topik biriktirilmagan — avval --create yoki --set");
    for (const b of rows) {
      const r = await tg("sendMessage", {
        chat_id: chatId,
        message_thread_id: b.leadTopicId,
        parse_mode: "HTML",
        text: `🔧 Sinov: <b>${b.name}</b> filialining yangi lidlari shu topikka tushadi.`,
      });
      console.log(`  ${b.name} → topik ${b.leadTopicId}: ${r.ok ? "✅ yetib bordi" : `❌ ${r.description}`}`);
    }
  }
} finally {
  await client.close();
}
