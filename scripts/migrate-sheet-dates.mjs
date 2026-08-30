// Jadvaldagi MAVJUD qatorlarning "Sana" va "Yangilangan" ustunlarini
// matndan HAQIQIY SANAGA o'tkazadi.
//
//   node scripts/migrate-sheet-dates.mjs          # quruq yurish
//   node scripts/migrate-sheet-dates.mjs --yes    # qo'llash
//
// NEGA KERAK: lib/sync/mappers.ts endi sanani Sheets seriyasi (son)
// bo'lib yozadi. Eski 25 000 dan ortiq qator esa matn bo'lib qolgan.
// Solishtirish (reconcile) bu farqni ko'rib ularni yangilashga urinardi,
// lekin bir yugurishda atigi 150 ta qator yangilanadi (MAX_UPDATES) —
// ya'ni butun tarixni tuzatishga 170 kun ketardi. Shuning uchun bir
// martalik ommaviy o'tkazish.
//
// Sana qiymati BAZADAN olinadi, jadvaldagi matndan tahlil qilinmaydi:
// baza etalon, matnni qayta o'qish esa noaniqlik qo'shardi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}
const APPLY = process.argv.includes("--yes");

// lib/sync/mappers.ts dagi hisob bilan AYNAN bir xil bo'lishi shart.
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
const dateSerial = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  if (!m) return String(iso ?? "");
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - SHEETS_EPOCH_MS) / DAY_MS);
};
const nowSerial = () => (Date.now() + 5 * 3_600_000 - SHEETS_EPOCH_MS) / DAY_MS;

const normKey = (raw) => {
  let k = (raw || "").trim();
  if (k.startsWith('"') && k.endsWith('"')) k = k.slice(1, -1);
  return k.replace(/\\n/g, "\n");
};
const b64 = (v) => Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const now = Math.floor(Date.now() / 1000);
const jwtInput = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
  iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
  scope: "https://www.googleapis.com/auth/spreadsheets",
  aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
}))}`;
const signer = createSign("RSA-SHA256");
signer.update(jwtInput);
signer.end();
const { access_token } = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${jwtInput}.${b64(signer.sign(normKey(process.env.GOOGLE_PRIVATE_KEY)))}`,
  }),
})).json();

const ID = process.env.SHEET_ID_PAYMENTS.trim();
const api = async (method, url, body) => {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 400));
  return j;
};
const colLetter = (n) => {
  let s = "";
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

const TABS = [
  { title: process.env.SHEET_TAB_PAYMENTS || "To'lovlar", cols: 15, filter: { txType: "payIn" } },
  { title: process.env.SHEET_TAB_SALARIES || "Xodim oyliklari", cols: 14, filter: { txType: "payOut", txName: { $regex: "avans|oylik", $options: "i" } } },
  { title: process.env.SHEET_TAB_EXPENSES || "Xarajatlar", cols: 12, filter: { txType: "payOut", txName: { $not: /avans|oylik/i } } },
  { title: process.env.SHEET_TAB_TRANSFERS || "Ko'chirmalar", cols: 12, filter: { txType: "transfer" } },
];

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const te = db.collection("transaction_entries");

const stamp = nowSerial();
const updates = [];
for (const t of TABS) {
  // Jadvaldagi ID ustuni — qator TARTIBI shu yerda, bazadagi emas.
  const idCol = await api("GET", `https://sheets.googleapis.com/v4/spreadsheets/${ID}/values/${encodeURIComponent(`${t.title}!A2:A`)}?valueRenderOption=UNFORMATTED_VALUE`);
  const ids = (idCol.values ?? []).map((r) => Number(r[0]));

  const dateOf = new Map(
    (await te.find(t.filter).project({ id: 1, date: 1 }).toArray()).map((d) => [d.id, d.date]),
  );

  let missing = 0;
  const sana = ids.map((id) => {
    const iso = dateOf.get(id);
    if (!iso) { missing += 1; return [""]; }
    return [dateSerial(iso)];
  });
  const yangilangan = ids.map(() => [stamp]);

  console.log(`${t.title.padEnd(18)} ${ids.length} qator${missing ? ` · ${missing} tasining sanasi bazada topilmadi` : ""}`);
  if (ids.length === 0) continue;

  const last = ids.length + 1; // sarlavha 1-qator
  updates.push({ range: `${t.title}!B2:B${last}`, values: sana });
  updates.push({ range: `${t.title}!${colLetter(t.cols - 1)}2:${colLetter(t.cols - 1)}${last}`, values: yangilangan });
}

console.log(`\n${updates.length} ta diapazon yangilanadi (${updates.reduce((s, u) => s + u.values.length, 0)} katak × 2 ustun).`);
if (!APPLY) {
  console.log("QURUQ YURISH — hech narsa o'zgartirilmadi. Qo'llash uchun --yes qo'shing.");
  await client.close();
  process.exit(0);
}

// RAW — Google yuborilgan sonni TALQIN QILMASIN. Ko'rinishini ustun
// formati beradi (scripts/setup-sheets-format.mjs).
await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${ID}/values:batchUpdate`, {
  valueInputOption: "RAW",
  data: updates,
});
console.log("✓ Yozildi.");

// Tekshiruv: endi B ustuni SON bo'lishi kerak.
const check = await api("GET", `https://sheets.googleapis.com/v4/spreadsheets/${ID}?` +
  TABS.map((t) => `ranges=${encodeURIComponent(`${t.title}!B2:B2`)}`).join("&") +
  "&fields=sheets(properties(title),data(rowData(values(effectiveValue,formattedValue))))");
console.log("\n— Tekshiruv (har varaqning 1-ma'lumot qatori) —");
for (const s of check.sheets) {
  const c = s.data?.[0]?.rowData?.[0]?.values?.[0];
  const v = c?.effectiveValue ?? {};
  const turi = "numberValue" in v ? "SON ✓" : "stringValue" in v ? "MATN ✗" : "bo'sh";
  console.log(`  ${s.properties.title.padEnd(18)} ${turi.padEnd(7)} ko'rinishi: "${c?.formattedValue ?? ""}"`);
}
await client.close();
