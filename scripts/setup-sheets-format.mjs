// Google jadvalni ODAM ISHLATADIGAN holatga keltiradi.
//
//   node scripts/setup-sheets-format.mjs          # quruq yurish
//   node scripts/setup-sheets-format.mjs --yes    # qo'llash
//
// MA'LUMOTGA TEGMAYDI — faqat ko'rinish va sozlama:
//   • bo'sh "Sheet1" o'chiriladi (jadval yaratilganda qoladigan axlat);
//   • mintaqa Asia/Tashkent qilinadi (sana/vaqt shunga qarab ko'rsatiladi);
//   • har bir varaqqa filtr qo'yiladi (saralash/filtrlash uchun);
//   • "Summa" ustuniga ming ajratgichli format beriladi;
//   • sarlavha qatori bo'yaladi va markazlanadi;
//   • ustun kengliklari mazmuniga qarab sozlanadi;
//   • bekor qilingan qator qizil, kutilayotgani sariq bo'lib ajralib turadi.
//
// NEGA SKRIPT, QO'LDA EMAS: bu amallar to'rt varaqda takrorlanadi va
// jadval qayta yaratilsa yoki varaq o'chib ketsa yana kerak bo'ladi.
// Qo'lda qilinsa, keyingi safar nima qilinganini hech kim eslay olmaydi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}
const APPLY = process.argv.includes("--yes");

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

const meta = await api("GET", `https://sheets.googleapis.com/v4/spreadsheets/${ID}?fields=properties(timeZone),sheets(properties(sheetId,title,gridProperties),basicFilter,conditionalFormats)`);
const byTitle = new Map(meta.sheets.map((s) => [s.properties.title, s]));

// "Xodim oyliklari" — HISOB varag'i (pastda alohida formatlanadi), jurnal
// varag'i emas. Ikkalasi adashib ketmasin: lib/sync/config.ts dagi
// SALARY_SUMMARY_TAB bilan bir xil nom.
const SUMMARY_TAB = "Xodim oyliklari";
const journalTab = (raw) => {
  const v = (raw || "").trim();
  return !v || v === SUMMARY_TAB ? "Xodim avanslari" : v;
};

// Har bir varaqning ustun tartibi lib/sync/mappers.ts dagi sarlavhalar
// bilan bir xil. `status` va `summa` — 0 dan boshlangan ustun raqami.
const TABS = [
  { title: process.env.SHEET_TAB_PAYMENTS || "To'lovlar", cols: 15, summa: 7, status: 13,
    widths: [60, 90, 60, 190, 170, 170, 150, 110, 110, 140, 170, 110, 200, 110, 130] },
  // Jurnal varag'i. Nomi lib/sync/config.ts dagi `journalTabName` bilan
  // bir xil qoida bo'yicha tanlanadi: eski sozlamada "Xodim oyliklari"
  // turgan bo'lsa e'tiborsiz qoldiriladi, aks holda jurnal formati HISOB
  // varag'iga qo'llanib, ustunlar mos kelmay qolardi.
  { title: journalTab(process.env.SHEET_TAB_SALARIES), cols: 14, summa: 7, status: 12,
    widths: [60, 90, 60, 190, 110, 110, 150, 110, 110, 140, 170, 200, 110, 130] },
  { title: process.env.SHEET_TAB_EXPENSES || "Xarajatlar", cols: 12, summa: 5, status: 10,
    widths: [60, 90, 60, 190, 150, 110, 110, 140, 170, 200, 110, 130] },
  { title: process.env.SHEET_TAB_TRANSFERS || "Ko'chirmalar", cols: 12, summa: 5, status: 10,
    widths: [60, 90, 60, 90, 260, 110, 110, 140, 170, 200, 110, 130] },
];

const colLetter = (n) => {
  let s = "";
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

const requests = [];
const plan = [];

// 1) Mintaqa. Sana/vaqt shunga qarab ko'rsatiladi; Etc/GMT bo'lsa
//    Toshkent bilan 5 soat farq chiqadi.
if (meta.properties.timeZone !== "Asia/Tashkent") {
  plan.push(`mintaqa: ${meta.properties.timeZone} -> Asia/Tashkent`);
  requests.push({ updateSpreadsheetProperties: { properties: { timeZone: "Asia/Tashkent" }, fields: "timeZone" } });
}

// 2) Bo'sh "Sheet1" — jadval yaratilganda avtomatik paydo bo'ladigan
//    varaq. Faqat HAQIQATAN bo'sh bo'lsa o'chiriladi.
const junk = byTitle.get("Sheet1");
if (junk) {
  const vals = await api("GET", `https://sheets.googleapis.com/v4/spreadsheets/${ID}/values/${encodeURIComponent("Sheet1!A1:Z50")}`);
  if (!vals.values || vals.values.length === 0) {
    plan.push('bo\'sh "Sheet1" varag\'i o\'chiriladi');
    requests.push({ deleteSheet: { sheetId: junk.properties.sheetId } });
  } else {
    plan.push('⚠️  "Sheet1" da ma\'lumot bor — TEGILMADI');
  }
}

for (const t of TABS) {
  const sheet = byTitle.get(t.title);
  if (!sheet) { plan.push(`⚠️  "${t.title}" varag'i topilmadi`); continue; }
  const sheetId = sheet.properties.sheetId;
  const rows = sheet.properties.gridProperties.rowCount;

  // 3) Sarlavha qatori — ko'k fon, oq qalin matn, markazda.
  plan.push(`${t.title}: sarlavha bo'yaladi`);
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: t.cols },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.17, green: 0.33, blue: 0.53 },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
        },
      },
      fields: "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)",
    },
  });

  // 4) Summa ustuni — ming ajratgich. Bo'sh katak "0" ko'rinmasin
  //    uchun format shartli: musbat/manfiy/nol/matn.
  plan.push(`${t.title}: "Summa" ustuniga ming ajratgich`);
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: t.summa, endColumnIndex: t.summa + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0" }, horizontalAlignment: "RIGHT" } },
      fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
    },
  });

  // 4b) "Sana" (B) va "Yangilangan" (oxirgi ustun) — SANA formati.
  //     Modul bu kataklarga son (Sheets seriyasi) yozadi; ko'rinishini
  //     shu format hal qiladi. Formatsiz ular 45933 bo'lib turadi.
  plan.push(`${t.title}: "Sana" va "Yangilangan" ustunlariga sana formati`);
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 },
      cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd.MM.yyyy" }, horizontalAlignment: "CENTER" } },
      fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: t.cols - 1, endColumnIndex: t.cols },
      cell: { userEnteredFormat: { numberFormat: { type: "DATE_TIME", pattern: "dd.MM.yyyy HH:mm" } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  // 5) Ustun kengliklari — ism va izoh uchun keng, ID/vaqt uchun tor.
  plan.push(`${t.title}: ustun kengliklari`);
  t.widths.forEach((px, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    });
  });

  // 6) Filtr. Bori o'chirilib qayta qo'yiladi — ustunlar soni
  //    o'zgargan bo'lsa eskisi noto'g'ri diapazonni ushlab turadi.
  if (sheet.basicFilter) requests.push({ clearBasicFilter: { sheetId } });
  plan.push(`${t.title}: filtr qo'yiladi`);
  requests.push({
    setBasicFilter: {
      filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: t.cols } },
    },
  });

  // 7) Shartli formatlash: bekor qilingan — qizil, kutilayotgan — sariq.
  //    Eskilari avval o'chiriladi (indeks 0 dan takror-takror).
  for (let i = (sheet.conditionalFormats ?? []).length - 1; i >= 0; i -= 1) {
    requests.push({ deleteConditionalFormatRule: { sheetId, index: i } });
  }
  const statusRef = `$${colLetter(t.status)}2`;
  plan.push(`${t.title}: bekor qilingan/kutilayotgan qatorlar bo'yaladi`);
  const rule = (text, color) => ({
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: rows, startColumnIndex: 0, endColumnIndex: t.cols }],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=${statusRef}="${text}"` }] },
          format: { backgroundColor: color },
        },
      },
    },
  });
  requests.push(rule("Bekor qilindi", { red: 0.98, green: 0.89, blue: 0.89 }));
  requests.push(rule("Kutilmoqda", { red: 1, green: 0.96, blue: 0.85 }));
}

// 8) "Xodim oyliklari" — HISOB varag'i, yuqoridagi jurnal varaqlaridan
//    tuzilishi bilan boshqacha, shuning uchun alohida blok:
//      • B ustunida "Sana" yo'q — birinchi ustun xodim ismi;
//      • "Yangilangan" MATN (lib/sync/salarySheet.ts uni "05.09.2026 18:56"
//        deb yozadi, Sheets seriyasi emas) — sana formati zarar qilardi;
//      • holat ustuni yo'q — bekor qilingan/kutilayotgan qator bo'lmaydi;
//      • pul ustuni bitta emas, TO'RTTA (Hisoblangan..Qolgan).
//    Nom lib/sync/config.ts dagi SALARY_SUMMARY_TAB bilan bir xil
//    bo'lishi shart — u sozlanmaydi, shu bois bu yerda ham qattiq yozilgan.
const SUMMARY = {
  title: SUMMARY_TAB,
  cols: 9,
  money: [3, 4, 5, 6], // Hisoblangan, Soliq, Olingan, Qolgan
  widths: [190, 120, 80, 130, 110, 120, 130, 160, 140],
};
const summarySheet = byTitle.get(SUMMARY.title);
if (!summarySheet) {
  plan.push(`⚠️  "${SUMMARY.title}" varag'i topilmadi — sinxronizatsiya bir marta ishlasin`);
} else {
  const sheetId = summarySheet.properties.sheetId;
  plan.push(`${SUMMARY.title}: sarlavha bo'yaladi`);
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: SUMMARY.cols },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.17, green: 0.33, blue: 0.53 },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
        },
      },
      fields: "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)",
    },
  });

  plan.push(`${SUMMARY.title}: pul ustunlariga ming ajratgich`);
  for (const c of SUMMARY.money) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: c, endColumnIndex: c + 1 },
        cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0" }, horizontalAlignment: "RIGHT" } },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    });
  }

  plan.push(`${SUMMARY.title}: ustun kengliklari`);
  SUMMARY.widths.forEach((px, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    });
  });

  if (summarySheet.basicFilter) requests.push({ clearBasicFilter: { sheetId } });
  plan.push(`${SUMMARY.title}: filtr qo'yiladi`);
  requests.push({
    setBasicFilter: {
      filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: SUMMARY.cols } },
    },
  });
}

console.log("Bajariladigan ishlar:\n" + plan.map((p) => "  • " + p).join("\n"));
console.log(`\nJami ${requests.length} ta so'rov.`);

if (!APPLY) {
  console.log("\nQURUQ YURISH — hech narsa o'zgartirilmadi. Qo'llash uchun --yes qo'shing.");
  process.exit(0);
}

await api("POST", `https://sheets.googleapis.com/v4/spreadsheets/${ID}:batchUpdate`, { requests });
console.log("\n✓ Qo'llandi.");

const after = await api("GET", `https://sheets.googleapis.com/v4/spreadsheets/${ID}?fields=properties(timeZone),sheets(properties(title,gridProperties(frozenRowCount)),basicFilter,conditionalFormats)`);
console.log(`\n— Tekshiruv —\n  mintaqa: ${after.properties.timeZone}`);
for (const s of after.sheets) {
  console.log(`  ${s.properties.title.padEnd(18)} muzlatilgan=${s.properties.gridProperties.frozenRowCount ?? 0} filtr=${s.basicFilter ? "bor" : "YO'Q"} shartli=${(s.conditionalFormats ?? []).length}`);
}
