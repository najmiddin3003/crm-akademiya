// Google jadvalga "Oylik hisobot" varag'ini qo'shadi (yoki yangilaydi).
//
//   node scripts/setup-sheets-report.mjs          # quruq yurish
//   node scripts/setup-sheets-report.mjs --yes    # qo'llash
//
// ── NEGA FORMULA, NEGA TAYYOR SON EMAS ───────────────────────────────
// Ma'lumot varaqlari har kuni cron orqali yangilanadi. Agar bu yerga
// hisoblangan sonlar yozilsa, ertasiga ular eskirib qolardi va kimdir
// eski raqamga qarab qaror qabul qilishi mumkin edi. Formula esa
// jadvalning o'zi bilan birga yangilanadi.
//
// ── HISOB QOIDALARI (foydalanuvchi bilan kelishilgan) ────────────────
// Tushum   = o'quvchi to'lovlari MINUS qaytarilgan pul.
//            Qaytarish chiqim bo'lib yozilgan, lekin u yangi xarajat
//            emas — olingan pulning ortga ketishi. Xarajatga qo'shilsa,
//            bitta to'lov ham tushumni, ham xarajatni shishirardi
//            (2025-12 da 27 mlrd so'mlik xato kirim aynan shunday
//            ko'ringan edi).
// Xarajat  = Xarajatlar varag'i MINUS "F - INVEST" MINUS qaytarish.
// Sof      = Tushum − Xarajat − Oylik. Ya'ni OPERATSION foyda.
// F-INVEST = bizneskdan olib chiqilgan pul, alohida ustunda. U xarajat
//            emas: naqshi aniq — avgustdagi olib chiqish iyul oyining
//            sof qoldig'iga tiyinigacha teng edi. Xarajat deb hisoblansa
//            12 oydan 5 tasi soxta "zarar" ko'rsatardi.
// Qolgan   = Sof − F-INVEST, ya'ni biznesda haqiqatan qolgan pul.
//
// ── NEGA BU VARAQ XAVFSIZ ────────────────────────────────────────────
// Solishtirish (lib/sync/reconcile.ts) faqat SYNC_KINDS dagi to'rt
// varaqni biladi va faqat ularga yozadi. Beshinchi varaqqa hech qachon
// tegmaydi, ya'ni bu yerdagi formulalar o'chib ketmaydi.
//
// ── CHEKLOV ──────────────────────────────────────────────────────────
// Oylar ro'yxati SKRIPT ishlagan paytda yoziladi: eng eski yozuvdan
// bugundan 12 oy keyingacha. Bir yildan ortiq vaqt o'tsa skriptni qayta
// ishga tushiring. Hali kelmagan oylar bo'sh ko'rinadi.
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
const REPORT_TAB = "Oylik hisobot";

const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
const serialOf = (y, m, d) => Math.round((Date.UTC(y, m, d) - SHEETS_EPOCH_MS) / DAY_MS);

const normKey = (raw) => {
  let k = (raw || "").trim();
  if (k.startsWith('"') && k.endsWith('"')) k = k.slice(1, -1);
  return k.replace(/\\n/g, "\n");
};
const b64 = (v) => Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const nowSec = Math.floor(Date.now() / 1000);
const jwtInput = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
  iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
  scope: "https://www.googleapis.com/auth/spreadsheets",
  aud: "https://oauth2.googleapis.com/token", iat: nowSec, exp: nowSec + 3600,
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

// Varaq nomi ichidagi apostrof formulada IKKI MARTA yoziladi
// ('To''lovlar'), aks holda Google nomni erta tugatilgan deb biladi.
// Kategoriya nomidagi apostrof esa oddiy belgi — qo'shtirnoq ichida
// hech narsa qilish shart emas (bazadagi nomlar ASCII, tekshirilgan).
const ref = (tab) => `'${tab.replace(/'/g, "''")}'`;
const PAY = ref(process.env.SHEET_TAB_PAYMENTS || "To'lovlar");
const SAL = ref(process.env.SHEET_TAB_SALARIES || "Xodim oyliklari");
const EXP = ref(process.env.SHEET_TAB_EXPENSES || "Xarajatlar");

// Ustun harflari lib/sync/mappers.ts dagi sarlavhalar tartibidan.
const C_PAY = { date: "B", amount: "H", status: "N" };
const C_SAL = { date: "B", amount: "H", status: "M" };
const C_EXP = { date: "B", cat: "E", amount: "F", status: "K" };

const REFUND = "O'quvchiga pul qaytarildi";
const INVEST = "F - INVEST";

/** Bir oy oralig'i + "Faol" holati — hamma yig'indiga umumiy shart. */
const monthArgs = (tab, c, row) =>
  `${tab}!$${c.date}:$${c.date},">="&$A${row},${tab}!$${c.date}:$${c.date},"<"&EDATE($A${row},1),` +
  `${tab}!$${c.status}:$${c.status},"Faol"`;

const sumOf = (tab, c, row, extra = "") =>
  `SUMIFS(${tab}!$${c.amount}:$${c.amount},${monthArgs(tab, c, row)}${extra})`;
const expCat = (name) => `,${EXP}!$${C_EXP.cat}:$${C_EXP.cat},"${name}"`;

const HEADERS = [
  "Oy", "Oy nomi", "Tushum", "Xarajat", "Oylik va avans",
  "Sof qoldiq", "F - INVEST", "Qolgan", "To'lovlar soni", "O'rtacha to'lov",
];
const FIRST_DATA_ROW = 3; // 1 — sarlavha, 2 — JAMI

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const agg = await db.collection("transaction_entries")
  .aggregate([{ $group: { _id: null, min: { $min: "$date" } } }]).toArray();
await client.close();
const [y0, m0] = (agg[0]?.min ?? "2025-09-01").split("-").map(Number);

const today = new Date();
const endY = today.getUTCFullYear() + 1;
const endM = today.getUTCMonth() + 1;
const months = [];
for (let y = y0, m = m0; y < endY || (y === endY && m <= endM); ) {
  months.push({ y, m });
  m += 1;
  if (m > 12) { m = 1; y += 1; }
}

const lastRow = FIRST_DATA_ROW + months.length - 1;
const rows = [HEADERS];

// JAMI qatori sarlavha tagida — 2 qator muzlatilgani uchun doim ko'rinib
// turadi. Pastda bo'lsa 25 oy aylantirish kerak bo'lardi.
rows.push([
  "", "JAMI",
  ...["C", "D", "E", "F", "G", "H", "I"].map((c) => `=SUM(${c}${FIRST_DATA_ROW}:${c}${lastRow})`),
  `=IFERROR(C2/I2,"")`,
]);

const UZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
months.forEach(({ y, m }, i) => {
  const r = FIRST_DATA_ROW + i;
  // Hali boshlanmagan oy bo'sh qolsin — nol bilan to'ldirilgan qator
  // "shu oyda hech narsa bo'lmagan" degan noto'g'ri taassurot berardi.
  const g = (expr) => `=IF($A${r}>EOMONTH(TODAY(),0),"",${expr})`;
  const refund = sumOf(EXP, C_EXP, r, expCat(REFUND));
  const invest = sumOf(EXP, C_EXP, r, expCat(INVEST));
  rows.push([
    serialOf(y, m - 1, 1),
    `=IF($A${r}="","",CHOOSE(MONTH($A${r}),${UZ.map((n) => `"${n}"`).join(",")})&" "&YEAR($A${r}))`,
    g(`${sumOf(PAY, C_PAY, r)}-${refund}`),
    g(`${sumOf(EXP, C_EXP, r)}-${invest}-${refund}`),
    g(sumOf(SAL, C_SAL, r)),
    g(`C${r}-D${r}-E${r}`),
    g(invest),
    g(`F${r}-G${r}`),
    g(`COUNTIFS(${monthArgs(PAY, C_PAY, r)})`),
    g(`IFERROR(C${r}/I${r},"")`),
  ]);
});

const NOTE = [
  ["IZOH"],
  ["Tushum = o'quvchi to'lovlari − qaytarilgan pul."],
  ["Xarajat ichida F - INVEST va qaytarish YO'Q — ular alohida."],
  ["Sof qoldiq = Tushum − Xarajat − Oylik (operatsion foyda)."],
  ["F - INVEST = bizneskdan olib chiqilgan pul, xarajat emas."],
  ["Qolgan = Sof qoldiq − F - INVEST."],
  ["Faqat \"Faol\" yozuvlar; bekor qilinganlari hisobga olinmaydi."],
  ["Oxirgi oy hali tugamagan bo'lishi mumkin."],
  ["Raqamlar — formula. Ma'lumot yangilansa o'zi yangilanadi."],
  ["Bu varaqni kod tahrirlamaydi, bemalol o'zgartirsangiz bo'ladi."],
];

console.log(`Varaq: "${REPORT_TAB}"`);
console.log(`Oylar: ${months.length} ta (${y0}-${String(m0).padStart(2, "0")} dan ${endY}-${String(endM).padStart(2, "0")} gacha)`);
console.log(`Ustunlar: ${HEADERS.join(" · ")}`);
if (!APPLY) {
  console.log("\nQURUQ YURISH — hech narsa o'zgartirilmadi. Qo'llash uchun --yes qo'shing.");
  process.exit(0);
}

const meta = await api("GET", `https://sheets.googleapis.com/v4/spreadsheets/${ID}?fields=sheets(properties(sheetId,title))`);
const existing = meta.sheets.find((s) => s.properties.title === REPORT_TAB);

// Varaq bor bo'lsa o'chirib qayta yaratamiz: ustunlar yoki oylar soni
// o'zgargan bo'lsa eski kataklar qolib ketmasin.
const pre = [];
if (existing) pre.push({ deleteSheet: { sheetId: existing.properties.sheetId } });
pre.push({
  addSheet: {
    properties: {
      title: REPORT_TAB,
      index: 0, // hisobot birinchi bo'lib ochilsin
      gridProperties: { rowCount: rows.length + 5, columnCount: 13, frozenRowCount: 2 },
      tabColor: { red: 0.17, green: 0.33, blue: 0.53 },
    },
  },
});
const added = await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${ID}:batchUpdate`, { requests: pre });
const sheetId = added.replies[added.replies.length - 1].addSheet.properties.sheetId;

// USER_ENTERED — formulalar HISOBLANSIN. Ma'lumot varaqlarida RAW
// ishlatiladi (u yerda talqin qilish zarar qilardi), bu yerda aksincha.
await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${ID}/values:batchUpdate`, {
  valueInputOption: "USER_ENTERED",
  data: [
    { range: `${REPORT_TAB}!A1`, values: rows },
    { range: `${REPORT_TAB}!L1`, values: NOTE },
  ],
});

const money = (start, end, startRow = 1) => ({
  repeatCell: {
    range: { sheetId, startRowIndex: startRow, startColumnIndex: start, endColumnIndex: end },
    cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0" }, horizontalAlignment: "RIGHT" } },
    fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
  },
});

await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${ID}:batchUpdate`, {
  requests: [
    { repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HEADERS.length },
      cell: { userEnteredFormat: {
        backgroundColor: { red: 0.17, green: 0.33, blue: 0.53 },
        horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP",
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
      } },
      fields: "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)",
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: HEADERS.length },
      cell: { userEnteredFormat: { backgroundColor: { red: 0.91, green: 0.94, blue: 0.98 }, textFormat: { bold: true } } },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
    } },
    { repeatCell: {
      range: { sheetId, startRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "MM.yyyy" }, horizontalAlignment: "CENTER" } },
      fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
    } },
    money(2, 10), // C..J — hamma son ustunlari
    // Zarar qizil: Sof qoldiq va Qolgan.
    ...[5, 7].map((col) => ({ addConditionalFormatRule: { index: 0, rule: {
      ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 }],
      booleanRule: {
        condition: { type: "NUMBER_LESS", values: [{ userEnteredValue: "0" }] },
        format: { textFormat: { foregroundColor: { red: 0.75, green: 0.11, blue: 0.11 }, bold: true } },
      },
    } } })),
    { repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 11, endColumnIndex: 12 },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: "userEnteredFormat.textFormat",
    } },
    ...[95, 130, 135, 130, 130, 135, 130, 130, 105, 125, 20, 380].map((px, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    })),
  ],
});

console.log("✓ Varaq yaratildi va formatlandi.");

const back = await api("GET", `https://sheets.googleapis.com/v4/spreadsheets/${ID}/values/${encodeURIComponent(`${REPORT_TAB}!A1:J${lastRow}`)}?valueRenderOption=UNFORMATTED_VALUE`);
const vals = back.values ?? [];
const f = (n) => (typeof n === "number" ? Math.round(n).toLocaleString("ru-RU") : String(n ?? ""));
console.log("\n— Hisoblangan natija —");
console.log("  oy                     tushum          xarajat        oylik            sof       F-INVEST         qolgan   soni");
const line = (label, r) =>
  console.log(`  ${String(label).padEnd(14)} ${f(r[2]).padStart(15)} ${f(r[3]).padStart(16)} ${f(r[4]).padStart(12)} ${f(r[5]).padStart(14)} ${f(r[6]).padStart(14)} ${f(r[7]).padStart(14)} ${f(r[8]).padStart(6)}`);
line("JAMI", vals[1]);
for (let i = 2; i < vals.length; i += 1) {
  const r = vals[i];
  if (!r || r[2] === "" || r[2] === undefined) continue;
  line(r[1], r);
}
