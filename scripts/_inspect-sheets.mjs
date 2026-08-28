// FAQAT O'QIYDI — Google jadvalning hozirgi holatini ko'rsatadi:
// varaqlar, muzlatilgan qatorlar, filtr, ustun kengligi va eng muhimi —
// kataklardagi qiymat MATNmi yoki SONmi/SANAmi.
//
// Nega oxirgisi muhim: modul qatorlarni `valueInputOption=RAW` bilan
// yozadi (lib/sync/googleSheets.ts) — ya'ni "28.08.2026" Google uchun
// SANA emas, oddiy MATN. Matnni sana bo'yicha saralab bo'lmaydi.
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
const normKey = (raw) => {
  let k = (raw || "").trim();
  if (k.startsWith('"') && k.endsWith('"')) k = k.slice(1, -1);
  return k.replace(/\\n/g, "\n");
};
const b64 = (v) => Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const now = Math.floor(Date.now() / 1000);
const input = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
  iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
  scope: "https://www.googleapis.com/auth/spreadsheets",
  aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
}))}`;
const signer = createSign("RSA-SHA256");
signer.update(input);
signer.end();
const { access_token } = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${input}.${b64(signer.sign(normKey(process.env.GOOGLE_PRIVATE_KEY)))}` }),
})).json();

const ID = process.env.SHEET_ID_PAYMENTS.trim();
const get = async (qs) => {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ID}?${qs}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return j;
};

const meta = await get(
  "fields=properties(title,locale,timeZone),sheets(properties(sheetId,title,index,gridProperties,tabColor),basicFilter,protectedRanges,conditionalFormats)",
);
console.log(`JADVAL: "${meta.properties.title}"`);
console.log(`  til/mintaqa : ${meta.properties.locale} · ${meta.properties.timeZone}`);
console.log(`  havola      : https://docs.google.com/spreadsheets/d/${ID}/edit\n`);

for (const s of meta.sheets) {
  const p = s.properties;
  const g = p.gridProperties ?? {};
  console.log(`VARAQ "${p.title}" (index ${p.index}, sheetId ${p.sheetId})`);
  console.log(`  o'lcham          : ${g.rowCount} qator × ${g.columnCount} ustun`);
  console.log(`  muzlatilgan      : ${g.frozenRowCount ? `${g.frozenRowCount} qator` : "YO'Q"}${g.frozenColumnCount ? ` + ${g.frozenColumnCount} ustun` : ""}`);
  console.log(`  filtr            : ${s.basicFilter ? "bor" : "YO'Q"}`);
  console.log(`  shartli formatlash: ${(s.conditionalFormats ?? []).length}`);
  console.log(`  himoyalangan     : ${(s.protectedRanges ?? []).length}`);
  console.log(`  rang             : ${p.tabColor ? "bor" : "yo'q"}`);
}

// Kataklar HAQIQATDA qanday saqlangan — matnmi, sonmi, sanami.
console.log("\n=== KATAKLAR TURI (2-qator, ya'ni birinchi ma'lumot qatori) ===");
const data = await get(
  meta.sheets
    .map((s) => `ranges=${encodeURIComponent(`${s.properties.title}!A1:O2`)}`)
    .join("&") + "&fields=sheets(properties(title),data(rowData(values(formattedValue,effectiveValue,effectiveFormat(numberFormat,textFormat(bold)),userEnteredFormat(horizontalAlignment)))))",
);
for (const s of data.sheets) {
  const rows = s.data?.[0]?.rowData ?? [];
  const header = rows[0]?.values ?? [];
  const first = rows[1]?.values ?? [];
  console.log(`\n  ${s.properties.title}`);
  console.log(`    sarlavha qalinmi: ${header[0]?.effectiveFormat?.textFormat?.bold ? "ha" : "YO'Q"}`);
  first.forEach((c, i) => {
    const v = c.effectiveValue ?? {};
    const turi = "numberValue" in v ? "SON" : "boolValue" in v ? "BOOL" : "stringValue" in v ? "matn" : "bo'sh";
    const fmt = c.effectiveFormat?.numberFormat?.type ?? "—";
    console.log(`    ${String(header[i]?.formattedValue ?? `#${i}`).padEnd(14)} ${turi.padEnd(5)} format=${String(fmt).padEnd(10)} "${String(c.formattedValue ?? "").slice(0, 22)}"`);
  });
}
