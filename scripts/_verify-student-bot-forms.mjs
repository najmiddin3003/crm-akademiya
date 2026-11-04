// O'QUVCHILAR BOTI: «Kursga yozilish» kartasi va «Ota-ona kirishi» — haqiqiy
// router (lib/botDispatch.ts), haqiqiy MongoDB, soxta Telegram.
//
//   node --experimental-transform-types --no-warnings --import ./scripts/_ts-alias.mjs scripts/_verify-student-bot-forms.mjs
//
// `MONGODB_URI` dagi serverda `tmp_bot_<tasodifiy>` bazasini ochadi va oxirida
// o'chiradi. Ish bazasiga TEGMAYDI: @/lib/mongodb shu bazani qaytaradigan stub.
// .env.local dan FAQAT MONGODB_URI o'qiladi, tokenlar soxta, `fetch` almashtirilgan —
// Telegram'ga bitta ham so'rov ketmaydi.
//
// BOT_SINOV_CHAT=<fayl> — asosiy oqimlar yozishmasini JSON ga yozadi (skrinshot uchun).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { MongoClient } from "mongodb";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*MONGODB_URI\s*=\s*(.+?)\s*$/.exec(line);
    if (m) process.env.MONGODB_URI ??= m[1];
  }
}
if (!process.env.MONGODB_URI) {
  console.log("MONGODB_URI yo'q — sinov ishlamaydi.");
  process.exit(1);
}
process.env.TELEGRAM_STUDENT_BOT_TOKEN = "111:sinov";
process.env.TELEGRAM_BOT_TOKEN = "222:sinov";
process.env.TELEGRAM_BOT_USERNAME = "sinov_xodim_bot";

const data = (code) => "data:text/javascript," + encodeURIComponent(code);
const STUBS = {
  "@/lib/mongodb": data("export async function ensureIndexes() { return globalThis.__db; } export async function getDb() { return globalThis.__db; }"),
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const DB_NAME = `tmp_bot_${randomBytes(3).toString("hex")}`;
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(DB_NAME);
globalThis.__db = db;
await Promise.all([
  db.collection("pupils").createIndex({ id: 1 }, { unique: true }),
  db.collection("orders").createIndex({ id: 1 }, { unique: true }),
  db.collection("student_bot_users").createIndex({ chatId: 1 }, { unique: true }),
  db.collection("student_bot_signups").createIndex({ chatId: 1 }, { unique: true }),
  db.collection("student_bot_parent_forms").createIndex({ chatId: 1 }, { unique: true }),
]);

// ── Soxta Telegram ───────────────────────────────────────────────────
const calls = [];
const chatLog = [];
let nextMsg = 100;
let seq = 1;
const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const tg = /api\.telegram\.org\/bot([^/]+)\/(\w+)/.exec(u);
  if (tg) {
    const body = init.body ? JSON.parse(init.body) : {};
    const method = tg[2];
    const result = method === "sendMessage" ? { message_id: nextMsg++ } : true;
    const call = { token: tg[1], method, body, messageId: result.message_id };
    calls.push(call);
    if ((method === "sendMessage" || method === "editMessageText") && body.text !== "⌛") {
      chatLog.push({ from: "bot", chatId: body.chat_id, text: body.text, markup: body.reply_markup ?? null, edit: method === "editMessageText" });
    }
    return json({ ok: true, result });
  }
  if (globalThis.__appFetch) return globalThis.__appFetch(u, init);
  throw new Error(`Kutilmagan tarmoq so'rovi: ${u}`);
};

const { dispatchBotUpdate } = await import("@/lib/botDispatch");
const { loadSurveyConfig } = await import("@/lib/surveyServer");
const { nameWords, sameName, splitPupilName } = await import("@/lib/studentBot/pupilMatch");
const { enrollOrderInGroup, findPupilForOrder } = await import("@/lib/enrollStudent");
const { findPupilForLead } = await import("@/lib/ai/actions/prepareStudents");

const deferred = [];
const defer = (fn) => deferred.push(fn);
async function dispatch(update) {
  await dispatchBotUpdate(db, update, defer);
  while (deferred.length) await deferred.shift()();
}
const who = (chatId) => ({ id: chatId, first_name: "Sinov", last_name: "Nik", username: "sinov" });
function send(chatId, text, extra = {}) {
  chatLog.push({ from: "user", chatId, text: extra.contact ? "📱 kontakt" : text });
  return dispatch({ message: { message_id: seq++, from: who(chatId), chat: { id: chatId, type: "private" }, text, ...extra } });
}
const toChat = (chatId) =>
  calls.filter((c) => String(c.body.chat_id) === String(chatId) && (c.method === "sendMessage" || c.method === "editMessageText") && c.body.text !== "⌛");
const last = (chatId) => toChat(chatId).at(-1);
const lastText = (chatId) => last(chatId)?.body.text ?? "";
const inlineOf = (call) => (call?.body.reply_markup?.inline_keyboard ?? []).flat();
const buttons = (chatId) => inlineOf(last(chatId)).map((b) => b.callback_data ?? b.text);
function press(chatId, dataValue) {
  const m = [...toChat(chatId)].reverse().find((c) => c.body.reply_markup?.inline_keyboard);
  const label = inlineOf(m).find((b) => b.callback_data === dataValue)?.text ?? dataValue;
  chatLog.push({ from: "user", chatId, text: label, tap: true });
  const messageId = m?.messageId ?? m?.body.message_id ?? 1;
  return dispatch({
    callback_query: { id: String(seq++), data: dataValue, from: who(chatId), message: { message_id: messageId, chat: { id: chatId, type: "private" } } },
  });
}

/** Anketani tasdiq ekranigacha to'ldiradi (fanlar → 5-sinf → filial → vaqt → ism → raqam → manba). */
async function fill(chatId, name, tel) {
  await send(chatId, "/yozilish");
  await press(chatId, "yz:y:fan");
  await press(chatId, "yz:f:0");
  await press(chatId, "yz:s:4");
  await press(chatId, "yz:b:1");
  await press(chatId, "yz:v:0");
  await send(chatId, name);
  await send(chatId, tel);
  await press(chatId, "yz:m:0");
  await press(chatId, "yz:n");
}
async function parentLogin(chatId, name, phone) {
  await send(chatId, "👪 Ota-ona kirishi");
  await send(chatId, name);
  await send(chatId, phone);
}

const user = (chatId) => db.collection("student_bot_users").findOne({ chatId });
const pupilOf = (id) => db.collection("pupils").findOne({ id });
const pupilCount = () => db.collection("pupils").countDocuments({});
const leads = () => db.collection("orders").find({}).toArray();
const form = (chatId) => db.collection("student_bot_parent_forms").findOne({ chatId });
const ids = (u) => u.links.map((l) => l.pupilId).sort((a, b) => a - b);

const base = { extraPhone: "", status: "Aktiv", branchId: 1, source: "Boshqa", category: "", birthDate: "", createdAt: "01.11.2026 | 10:00", balance: 0, coin: 0 };
async function reset() {
  delete process.env.STUDENT_BOT_SIGNUP_PUPIL;
  process.env.STUDENT_BOT_SIGNUP_PUPIL = "true";
  await db.command({ collMod: "pupils", validator: {} });
  const cols = await db.listCollections().toArray();
  await Promise.all(cols.map((c) => db.collection(c.name).deleteMany({})));
  await db.collection("branches").insertOne({ id: 1, name: "Temuriylar" });
  await db.collection("pupils").insertMany([
    { ...base, id: 1, firstName: "Vali Karim o'g'li", lastName: "Aliyev", phone: "90 111 22 33" },
    { ...base, id: 2, firstName: "Sardor", lastName: "Aliyev", phone: "90 111 22 33" },
    { ...base, id: 3, firstName: "G'ayrat", lastName: "Xasanov", phone: "", extraPhone: "+998 91 222 33 44" },
    { ...base, id: 4, firstName: "Malika", lastName: "Qodirova", phone: "", fatherPhone: "93 333 44 55" },
    { ...base, id: 5, firstName: "Aziz", lastName: "Karimov", phone: "94 444 55 66" },
    { ...base, id: 6, firstName: "Laylo", lastName: "Usmonova", phone: "97 777 88 99" },
  ]);
  await db.collection("hr_employees").insertMany([
    { id: 1, name: "Sinov Xodim", phone: "95 555 66 77", archReason: "" },
    { id: 2, name: "Ota Xodim", phone: "97 777 88 99", archReason: "" },
  ]);
  await db.collection("groups").insertOne({ id: 1, name: "Ingliz tili", teacher: "Ustoz", studentIds: [1], branchId: 1 });
  await db.collection("attendance").insertMany([
    { pupilId: 1, groupId: 1, date: "2026-11-02", status: "keldi" },
    { pupilId: 1, groupId: 1, date: "2026-11-03", status: "sababsiz" },
  ]);
  calls.length = 0;
  globalThis.__appFetch = undefined;
}

let bad = 0;
async function check(name, fn) {
  await reset();
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    bad++;
    console.log(`✗ ${name}\n    ${String(e.message).split("\n").slice(0, 3).join(" | ")}`);
  }
}

try {
  console.log("— Ism solishtirish");
  await check("ism tartibi, kirill, apostrof, x/h, q/k farq qilmaydi; boshqa ism mos kelmaydi", async () => {
    assert.ok(sameName("Aliyev Vali", "Vali Karim o'g'li Aliyev"));
    assert.ok(sameName("Хасанов Ғайрат", "G'ayrat Xasanov"));
    assert.ok(sameName("Hasanov G‘ayrat", "G'ayrat Xasanov"));
    assert.ok(sameName("MALIKA KODIROVA", "Malika Qodirova"));
    assert.ok(!sameName("Vali Aliyeva", "Vali Aliyev"));
    assert.ok(!sameName("Sardor Aliyev", "Vali Karim o'g'li Aliyev"));
    assert.equal(nameWords("Vali Vali").length, 1, "bitta so'zni ikki marta yozish ism familiya emas");
  });
  await check("ism familiya kartaga to'g'ri bo'linadi", async () => {
    assert.deepEqual(splitPupilName("Vali Aliyev"), { firstName: "Vali", lastName: "Aliyev" });
    assert.deepEqual(splitPupilName("Aliyev Vali"), { firstName: "Vali", lastName: "Aliyev" });
    assert.deepEqual(splitPupilName("Aliyeva Malika Karim qizi"), { firstName: "Malika Karim qizi", lastName: "Aliyeva" });
    assert.deepEqual(splitPupilName("Abdul Aziz Karimov"), { firstName: "Abdul Aziz", lastName: "Karimov" });
    assert.deepEqual(splitPupilName("Vali"), { firstName: "Vali", lastName: "" });
  });

  console.log("— Kursga yozilish: karta");
  await check("yangi odam: lid + karta + bog'lanish, /start menyuni ochadi", async () => {
    const chat = 5001;
    await send(chat, "/start");
    await fill(chat, "Bobur Toshmatov", "90 700 00 01");
    assert.match(lastText(chat), /Arizangizni tekshiring/);
    await press(chat, "yz:ok");
    assert.match(lastText(chat), /O'quvchi kartasi ochildi: <b>Bobur Toshmatov<\/b>/);
    assert.ok(buttons(chat).includes("home"), "«Asosiy menyu» tugmasi yo'q");

    const [lead] = await leads();
    assert.equal(lead.source, "Telegram bot");
    assert.equal(lead.phone, "90 700 00 01");
    const card = await pupilOf(lead.pupilId);
    const sc = await loadSurveyConfig(db);
    assert.equal(card.firstName, "Bobur");
    assert.equal(card.lastName, "Toshmatov");
    assert.equal(card.phone, lead.phone, "Guruhga qo'shish telefon bo'yicha ham topishi kerak");
    assert.equal(card.source, sc.manbalar[0]);
    assert.equal(card.branchId, 1);
    assert.equal(card.grade, 5);
    assert.equal(card.status, "Aktiv");
    assert.match(card.note, /Telegram botdan/);

    const u = await user(chat);
    assert.deepEqual(u.links, [{ pupilId: card.id, role: "student", via: "form" }]);
    assert.equal(u.phone, "907000001");
    await send(chat, "/start");
    assert.match(lastText(chat), /Bobur Toshmatov/);
    assert.ok(buttons(chat).includes("att"), "menyu ochilmadi");
    if (process.env.BOT_SINOV_CHAT) fs.writeFileSync(`${process.env.BOT_SINOV_CHAT}-yozilish.json`, JSON.stringify(chatLog.filter((m) => String(m.chatId) === String(chat)), null, 1));
  });

  await check("familiya oldin yozilsa ham karta to'g'ri", async () => {
    await fill(5002, "Toshmatov Bobur", "90 700 00 02");
    await press(5002, "yz:ok");
    const [lead] = await leads();
    const card = await pupilOf(lead.pupilId);
    assert.equal(card.firstName, "Bobur");
    assert.equal(card.lastName, "Toshmatov");
  });

  await check("shu ism va raqamli karta bor: ikkinchisi ochilmaydi, lid unga bog'lanadi", async () => {
    const before = await pupilCount();
    await fill(5003, "Aliyev Vali", "90 111 22 33");
    await press(5003, "yz:ok");
    assert.equal(await pupilCount(), before);
    assert.equal((await leads())[0].pupilId, 1);
    assert.match(lastText(5003), /kartasi bazada bor/);
    assert.deepEqual(ids(await user(5003)), [1], "ukasi (#2) ochilmasligi kerak");
  });

  await check("bir raqamda boshqa ism — yangi karta, faqat o'sha bog'lanadi", async () => {
    await fill(5004, "Jasur Aliyev", "90 111 22 33");
    await press(5004, "yz:ok");
    const [lead] = await leads();
    assert.ok(lead.pupilId > 6);
    assert.deepEqual(ids(await user(5004)), [lead.pupilId], "boshqa bolalar ochilib ketdi");
  });

  await check("familiyasiz ism qabul qilinmaydi, Telegram ismi tugmasi yo'q", async () => {
    await send(5005, "/yozilish");
    await press(5005, "yz:y:fan");
    await press(5005, "yz:f:0");
    await press(5005, "yz:s:4");
    await press(5005, "yz:b:1");
    await press(5005, "yz:v:0");
    assert.match(lastText(5005), /O'quvchining ism familiyasi/);
    assert.ok(!buttons(5005).includes("yz:nm"));
    await send(5005, "Bobur");
    assert.match(lastText(5005), /Ism va familiyani birga yozing/);
    await press(5005, "yz:nm");
    assert.match(lastText(5005), /O'quvchining ism familiyasi/, "eski tugma qadamni o'tkazib yubordi");
  });

  await check("«Yuborish» ikki marta bosilsa — bitta lid, bitta karta", async () => {
    await fill(5006, "Bobur Toshmatov", "90 700 00 06");
    const before = await pupilCount();
    await Promise.all([press(5006, "yz:ok"), press(5006, "yz:ok")]);
    assert.equal((await leads()).length, 1);
    assert.equal(await pupilCount(), before + 1);
  });

  await check("bog'langan ota-ona ikkinchi bolani yozdirsa: birinchisi qoladi, yangisi ochiladi", async () => {
    await parentLogin(5007, "Aziz Karimov", "94 444 55 66");
    await press(5007, "yz:go");
    await press(5007, "yz:y:fan");
    await press(5007, "yz:f:0");
    await press(5007, "yz:s:4");
    await press(5007, "yz:b:1");
    await press(5007, "yz:v:0");
    await send(5007, "Nodira Karimova");
    await send(5007, "✅ +998 94 444 55 66");
    await press(5007, "yz:m:0");
    await press(5007, "yz:n");
    await press(5007, "yz:ok");
    const [lead] = await leads();
    const u = await user(5007);
    assert.deepEqual(ids(u), [5, lead.pupilId]);
    assert.equal(u.activePupilId, lead.pupilId);
    assert.equal(u.links.find((l) => l.pupilId === lead.pupilId).role, "parent");
  });

  await check("karta ochilmasa ham ariza yo'qolmaydi", async () => {
    await db.command({ collMod: "pupils", validator: { firstName: { $ne: "Yiqilsin" } } });
    await fill(5008, "Yiqilsin Aliyev", "90 700 00 08");
    const before = await pupilCount();
    await press(5008, "yz:ok");
    assert.equal(await pupilCount(), before);
    const [lead] = await leads();
    assert.ok(lead, "lid saqlanmadi");
    assert.equal(lead.pupilId, undefined);
    assert.match(lastText(5008), /Arizangiz qabul qilindi/);
    assert.doesNotMatch(lastText(5008), /kartasi/);
    assert.equal(await user(5008), null);
  });

  await check("sozlama o'chiq markazda hammasi eskicha: faqat lid", async () => {
    delete process.env.STUDENT_BOT_SIGNUP_PUPIL;
    await send(5009, "/yozilish");
    await press(5009, "yz:y:fan");
    await press(5009, "yz:f:0");
    await press(5009, "yz:s:4");
    await press(5009, "yz:b:1");
    await press(5009, "yz:v:0");
    assert.match(lastText(5009), /Siz bilan qanday bog'lanamiz/);
    assert.ok(buttons(5009).includes("yz:nm"));
    await send(5009, "Bobur");
    await send(5009, "90 700 00 09");
    await press(5009, "yz:m:0");
    await press(5009, "yz:n");
    const before = await pupilCount();
    await press(5009, "yz:ok");
    assert.equal(await pupilCount(), before);
    assert.equal((await leads())[0].pupilId, undefined);
    assert.equal(await user(5009), null);
    assert.doesNotMatch(lastText(5009), /kartasi/);
  });

  console.log("— Ota-ona kirishi");
  await check("ism + raqam: farzand ochiladi, davomat ko'rinadi, aka-ukasi ochilmaydi", async () => {
    const chat = 6001;
    await send(chat, "/start");
    assert.ok(JSON.stringify(last(chat).body.reply_markup).includes("Ota-ona kirishi"));
    await send(chat, "👪 Ota-ona kirishi");
    assert.match(lastText(chat), /1\/2/);
    await send(chat, "Aliyev Vali");
    assert.match(lastText(chat), /2\/2/);
    await send(chat, "90 111 22 33");
    assert.match(lastText(chat), /Ota-ona sifatida/);
    const u = await user(chat);
    assert.deepEqual(u.links, [{ pupilId: 1, role: "parent", via: "form" }]);
    assert.equal(await form(chat), null);
    assert.ok(calls.some((c) => c.method === "sendMessage" && c.body.reply_markup?.remove_keyboard), "pastki tugmalar olib tashlanmadi");
    await press(chat, "att");
    assert.match(lastText(chat), /Davomat/);
    assert.match(lastText(chat), /Keldi/);
    assert.match(lastText(chat), /Sababsiz/);
    if (process.env.BOT_SINOV_CHAT) fs.writeFileSync(`${process.env.BOT_SINOV_CHAT}-otaona.json`, JSON.stringify(chatLog.filter((m) => String(m.chatId) === String(chat)), null, 1));
  });

  await check("raqam kartaning istalgan maydonida; yozuv shakli farq qilmaydi", async () => {
    await parentLogin(6002, "Хасанов Ғайрат", "+998 (91) 222-33-44");
    assert.deepEqual(ids(await user(6002)), [3]);
    await parentLogin(6003, "Malika Qodirova", "998933334455");
    assert.deepEqual(ids(await user(6003)), [4]);
  });

  await check("noto'g'ri ism yoki raqam: hech narsa ochilmaydi, sababi aytilmaydi", async () => {
    await parentLogin(6004, "Sherzod Aliyev", "90 111 22 33");
    assert.match(lastText(6004), /O'quvchi topilmadi/);
    assert.equal(await user(6004), null);
    assert.equal((await form(6004)).step, "ism");
    await send(6004, "Vali Aliyev");
    await send(6004, "90 000 00 00");
    assert.match(lastText(6004), /O'quvchi topilmadi/);
    assert.equal(await user(6004), null);
  });

  await check("bitta so'z yoki chala raqam: qadam takrorlanadi, urinish sanalmaydi", async () => {
    await send(6005, "👪 Ota-ona kirishi");
    await send(6005, "Vali");
    assert.match(lastText(6005), /Ism va familiyani birga yozing/);
    await send(6005, "Vali Vali");
    assert.match(lastText(6005), /Ism va familiyani birga yozing/);
    await send(6005, "Vali Aliyev");
    await send(6005, "12345");
    assert.match(lastText(6005), /Raqamni to'liq yozing/);
    assert.equal(await db.collection("student_bot_attempts").countDocuments({ chatId: 6005 }), 0);
    await send(6005, "90 111 22 33");
    assert.deepEqual(ids(await user(6005)), [1]);
  });

  await check("ko'p urinish to'xtatiladi", async () => {
    for (let i = 0; i < 5; i++) {
      await parentLogin(6006, "Vali Aliyev", `90 000 00 0${i}`);
      assert.match(lastText(6006), /O'quvchi topilmadi/);
      await press(6006, "ot:x");
    }
    await parentLogin(6006, "Vali Aliyev", "90 111 22 33");
    assert.match(lastText(6006), /Juda ko'p urinish/);
    assert.equal(await user(6006), null, "to'g'ri javob ham to'xtashi kerak");
    assert.equal(await form(6006), null);
  });

  await check("ikkinchi farzand: birinchisi qoladi, «Boshqa profil» chiqadi, begona id rad etiladi", async () => {
    await parentLogin(6007, "Malika Qodirova", "93 333 44 55");
    await press(6007, "set");
    assert.ok(buttons(6007).includes("ot:go"), "Sozlamalarda «Farzand qo'shish» yo'q");
    await press(6007, "ot:go");
    assert.match(lastText(6007), /1\/2/);
    await send(6007, "Aziz Karimov");
    await send(6007, "94 444 55 66");
    const u = await user(6007);
    assert.deepEqual(ids(u), [4, 5]);
    assert.equal(u.activePupilId, 5);
    assert.equal(u.phone, "933334455", "birinchi raqam saqlanishi kerak");
    assert.match(lastText(6007), /Aziz Karimov/);
    assert.ok(buttons(6007).includes("kids"));
    await press(6007, "kid:4");
    assert.match(lastText(6007), /Malika Qodirova/);
    await press(6007, "kid:1");
    assert.equal((await user(6007)).activePupilId, 4, "bog'lanmagan bola ochildi");
  });

  await check("raqam bilan qayta kirish forma bilan qo'shilgan bolani o'chirmaydi", async () => {
    await parentLogin(6008, "G'ayrat Xasanov", "91 222 33 44");
    await send(6008, "", { contact: { phone_number: "998944445566", user_id: 6008 } });
    assert.deepEqual(ids(await user(6008)), [3, 5]);
  });

  await check("bekor qilish: bog'lanmagan — boshlang'ich ekran, bog'langan — menyu", async () => {
    await send(6009, "👪 Ota-ona kirishi");
    await press(6009, "ot:x");
    assert.equal(await form(6009), null);
    assert.match(lastText(6009), /Assalomu alaykum/);
    await parentLogin(6009, "Aziz Karimov", "94 444 55 66");
    await press(6009, "set");
    await press(6009, "ot:go");
    await press(6009, "ot:x");
    assert.match(lastText(6009), /Aziz Karimov/);
    assert.ok(buttons(6009).includes("att"));
  });

  await check("forma ochiqligida /start uni yopadi; boshqa tugma ham", async () => {
    await send(6010, "👪 Ota-ona kirishi");
    await send(6010, "/start");
    assert.equal(await form(6010), null);
    await parentLogin(6010, "Aziz Karimov", "94 444 55 66");
    await press(6010, "set");
    await press(6010, "ot:go");
    await press(6010, "att");
    assert.equal(await form(6010), null);
    await send(6010, "salom");
    assert.ok(buttons(6010).includes("att"), "erkin matn formaga javob bo'lib ketdi");
  });

  await check("anketa ochiq paytda ota-ona tugmasi anketani yopadi va aksincha", async () => {
    await send(6011, "/yozilish");
    await send(6011, "👪 Ota-ona kirishi");
    assert.match(lastText(6011), /1\/2/);
    assert.equal((await db.collection("student_bot_signups").findOne({ chatId: 6011 })).step, "");
    await send(6011, "/yozilish");
    assert.equal(await form(6011), null);
    assert.match(lastText(6011), /Kursga yozilish/);
  });

  await check("forma ochiqligida eski «Kursga yozilish» tugmasi: keyingi matn anketaga tushadi", async () => {
    await send(6012, "👪 Ota-ona kirishi");
    await press(6012, "yz:go");
    assert.equal(await form(6012), null);
    await press(6012, "yz:y:fan");
    await press(6012, "yz:f:0");
    await press(6012, "yz:s:4");
    await press(6012, "yz:b:1");
    await press(6012, "yz:v:0");
    await send(6012, "Bobur Toshmatov");
    assert.match(lastText(6012), /Telefon raqamingiz/);
  });

  await check("havola bilan ochish: t.me/<bot>?start=otaona", async () => {
    await send(6013, "/start otaona");
    assert.match(lastText(6013), /1\/2/);
    assert.equal((await form(6013)).step, "ism");
  });

  console.log("— Xodim va o'quvchi tomoni (lib/botDispatch.ts)");
  await check("forma ochiqligida xodim raqami kirish hisoblanmaydi", async () => {
    await parentLogin(7001, "Vali Aliyev", "95 555 66 77");
    assert.match(lastText(7001), /O'quvchi topilmadi/);
  });

  await check("tizimga kirgan xodim ota-ona bo'la oladi, keyin /start o'z bolasini ochadi", async () => {
    await db.collection("staff_bot_users").insertOne({ chatId: 7002, stage: "in" });
    await send(7002, "/otaona");
    assert.match(lastText(7002), /1\/2/);
    await send(7002, "Aziz Karimov");
    await send(7002, "94 444 55 66");
    assert.deepEqual(ids(await user(7002)), [5]);
    await send(7002, "/start");
    assert.match(lastText(7002), /Aziz Karimov/);
  });

  await check("bog'lanmagan xodim /start bosganda xodimlar botiga yo'naltiriladi", async () => {
    await db.collection("staff_bot_users").insertOne({ chatId: 7003, stage: "in" });
    await send(7003, "/start");
    assert.match(lastText(7003), /Xodimlar boti ko'chdi/);
    assert.match(lastText(7003), /\/otaona/, "farzandi o'qiydigan xodimga yo'l aytilmadi");
    await send(7003, "/yozilish");
    assert.match(lastText(7003), /Kursga yozilish/, "xodim ham ariza qoldira oladi");
  });

  await check("xodim raqami: kartada ham bo'lsa o'quvchi tomoni, bo'lmasa yo'naltirish", async () => {
    await send(7004, "", { contact: { phone_number: "998977778899", user_id: 7004 } });
    assert.deepEqual(ids(await user(7004)), [6]);
    await send(7005, "", { contact: { phone_number: "998955556677", user_id: 7005 } });
    assert.match(lastText(7005), /Xodimlar boti ko'chdi/);
    assert.equal(await user(7005), null);
  });

  await check("/xodim bog'langan odamni ham xodimlar botiga yuboradi", async () => {
    await parentLogin(7006, "Aziz Karimov", "94 444 55 66");
    await send(7006, "/xodim");
    assert.match(lastText(7006), /Xodimlar boti ko'chdi/);
  });

  console.log("— «Guruhga qo'shish» ikkinchi karta ochmaydi");
  const orderBase = { id: 1, name: "Bobur Toshmatov", phone: "90 700 00 01", category: "", firstLesson: "" };
  const appFetch = (fresh) => {
    const log = [];
    globalThis.__appFetch = async (u, init) => {
      const method = init.method ?? "GET";
      log.push(`${method} ${u}`);
      if (method === "GET" && u.startsWith("/api/pupils")) return json({ ok: true, pupils: fresh });
      if (u === "/api/pupils") return json({ ok: true, pupil: { id: 99, firstName: "Yangi", lastName: "Karta", phone: "" } });
      if (u.endsWith("/students")) return json({ ok: true, body: init.body });
      throw new Error(`Kutilmagan so'rov: ${u}`);
    };
    return log;
  };
  await check("lidning kartasi aka-ukadan ustun", async () => {
    const list = [
      { id: 10, firstName: "Ukasi", lastName: "Toshmatov", phone: "90 700 00 01" },
      { id: 7, firstName: "Bobur", lastName: "Toshmatov", phone: "90 700 00 01" },
    ];
    assert.equal(findPupilForOrder({ ...orderBase, pupilId: 7 }, list).id, 7);
    assert.equal(findPupilForOrder(orderBase, list).id, 10, "pupilId siz eskicha qolishi kerak");
  });
  await check("sahifadagi ro'yxat eski bo'lsa ham karta topiladi", async () => {
    const log = appFetch([{ id: 7, firstName: "Bobur", lastName: "Toshmatov", phone: "90 700 00 01" }]);
    const out = await enrollOrderInGroup({ ...orderBase, pupilId: 7 }, 3, []);
    assert.equal(out.ok, true);
    assert.equal(out.pupil.id, 7);
    assert.equal(out.created, false);
    assert.ok(!log.includes("POST /api/pupils"), "ikkinchi karta ochildi");
  });
  await check("karta o'chirilgan bo'lsa odatdagidek yangisi ochiladi", async () => {
    const log = appFetch([]);
    const out = await enrollOrderInGroup({ ...orderBase, pupilId: 7 }, 3, []);
    assert.equal(out.ok, true);
    assert.equal(out.created, true);
    assert.ok(log.includes("POST /api/pupils"));
  });
  await check("AI yordamchi ham lidning kartasini oladi", async () => {
    const ctx = { db, scope: { branchId: 1, allowed: [1], isAdmin: true } };
    const got = await findPupilForLead(ctx, { name: "Boshqa Ism", phone: "90 111 22 33", pupilId: 5 });
    assert.equal(got.id, 5);
    assert.equal((await findPupilForLead(ctx, { name: "Sardor Aliyev", phone: "90 111 22 33" })).id, 2, "pupilId siz eskicha");
  });
} finally {
  assert.ok(db.databaseName.startsWith("tmp_bot_"));
  await db.dropDatabase();
  const left = await client.db("admin").admin().listDatabases({ nameOnly: true }).then((r) => r.databases.some((d) => d.name === DB_NAME)).catch(() => "tekshirilmadi");
  await client.close();
  console.log(`\nVaqtinchalik baza o'chirildi (qolganmi: ${left}).`);
}
console.log(bad ? `${bad} ta sinov o'tmadi.` : "Hammasi to'g'ri.");
process.exit(bad ? 1 : 0);
