import { createSign } from "node:crypto";
import { describePrivateKey } from "@/lib/sync/config";
import type { SyncConfig } from "@/lib/sync/config";

// Google Sheets API v4 bilan ishlash — `googleapis` paketisiz.
//
// Nega paketsiz? Rasmiy `googleapis` ~50 MB va yuzlab bog'liqlik olib
// keladi, bizga esa atigi bir nechta endpoint kerak. Service account
// JWT'ini node:crypto o'zi RS256 bilan imzolaydi, qolgani oddiy fetch.
//
// Autentifikatsiya zanjiri:
//   JWT (service account kaliti bilan imzolangan)
//     -> oauth2.googleapis.com/token
//     -> access_token (1 soat amal qiladi, xotirada saqlanadi)
//     -> sheets.googleapis.com so'rovlarida Bearer sifatida

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Token bir necha so'rov uchun qayta ishlatiladi (har safar yangi olish —
// ortiqcha kechikish va Google tomonda limit). Muddati tugashiga 60
// soniya qolganda yangilanadi.
let cachedToken: { value: string; expiresAt: number; owner: string } | null = null;

export async function getAccessToken(cfg: SyncConfig): Promise<string> {
  const owner = cfg.google.clientEmail;
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.owner === owner && cachedToken.expiresAt - 60 > now) {
    return cachedToken.value;
  }
  if (!cfg.google.clientEmail || !cfg.google.privateKey) {
    throw new Error("Google service account sozlanmagan (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)");
  }

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: cfg.google.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;

  let signature: string;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(signingInput);
    signer.end();
    signature = b64url(signer.sign(cfg.google.privateKey));
  } catch {
    // Eng ko'p uchraydigan sabab — .env dagi kalitda \n lar haqiqiy yangi
    // qatorga aylantirilmagan. config.ts buni tuzatadi, lekin kalit
    // butunlay noto'g'ri nusxalangan bo'lsa shu yerga tushadi.
    //
    // Kalitning SHAKLI xabarga qo'shiladi — usiz "noto'g'ri" degan so'z
    // o'nlab sababga to'g'ri kelardi va Vercel'dagi qiymatni tashqaridan
    // ko'rib bo'lmaydi. Maxfiy qism chiqmaydi (describePrivateKey izohi).
    throw new Error(
      `GOOGLE_PRIVATE_KEY noto'g'ri — JSON fayldagi private_key to'liq nusxalanganini tekshiring ` +
      `[${describePrivateKey(cfg.google.privateKey)}]`,
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${signature}`,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token olinmadi: ${data.error_description || data.error || res.status}`);
  }
  cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in ?? 3600), owner };
  return data.access_token;
}

/**
 * A1 notatsiyasida varaq nomi. O'zbekcha nomlarda apostrof bor
 * ("To'lovlar") — u IKKILANTIRILISHI va nom qo'shtirnoq ichiga olinishi
 * shart, aks holda Google so'rovni tushunmaydi.
 */
function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function rangeParam(tabName: string, a1: string): string {
  return encodeURIComponent(`${quoteSheetName(tabName)}!${a1}`);
}

/**
 * Sheets API so'rovi — 429 (limit) va 5xx (vaqtinchalik nosozlik) da
 * eksponensial kutish bilan qayta uriniladi. 4xx xatolarda darhol
 * to'xtaydi: ular qayta urinishdan tuzalmaydi (masalan jadval service
 * account'ga share qilinmagan).
 */
async function sheetsFetch(
  cfg: SyncConfig,
  url: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<Record<string, unknown>> {
  const token = await getAccessToken(cfg);
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (res.ok) return (await res.json()) as Record<string, unknown>;

  const text = await res.text();
  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt < 3) {
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    return sheetsFetch(cfg, url, init, attempt + 1);
  }
  if (res.status === 403) {
    throw new Error(
      `Google ruxsat bermadi (403) — jadval ${cfg.google.clientEmail} manziliga "Editor" qilib share qilinganini tekshiring`,
    );
  }
  if (res.status === 404) {
    throw new Error("Google jadval topilmadi (404) — SHEET_ID to'g'riligini tekshiring");
  }
  throw new Error(`Google Sheets xatosi ${res.status}: ${text.slice(0, 300)}`);
}

export interface TabInfo {
  /** Varaqning raqamli id'si (gid) — qator o'chirish uchun kerak. */
  sheetId: number;
  tabName: string;
}

/** Jadval katagi — matn yoki son (summa ustuni haqiqiy son bo'lib yoziladi). */
export type SheetCell = string | number;

/**
 * Varaq mavjudligini ta'minlaydi: bo'lmasa yaratadi, sarlavha qatorini
 * yozadi va uni muzlatib qo'yadi. Ya'ni foydalanuvchi jadvalni BO'SH
 * yaratsa yetarli — ustunlarni qo'lda yozish shart emas.
 */
export async function ensureTab(
  cfg: SyncConfig,
  spreadsheetId: string,
  tabName: string,
  headers: string[],
): Promise<TabInfo> {
  const meta = (await sheetsFetch(
    cfg,
    // `gridProperties.columnCount` — mavjud varaqda ustun YETARLIMI degan
    // savol uchun. Usiz yangi ustun jimgina yozilmay qolardi (pastga qarang).
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties.columnCount)`,
  )) as {
    sheets?: { properties: { sheetId: number; title: string; gridProperties?: { columnCount?: number } } }[];
  };

  const existing = (meta.sheets || []).find((s) => s.properties.title === tabName);
  if (existing) {
    // SARLAVHA QATORI TEKSHIRILADI — ilgari mavjud varaq shartsiz qabul
    // qilinardi.
    //
    // NEGA QO'SHILDI: "Xodim oyliklari" nomi endi HISOBLANGAN oylik
    // varag'iniki, jurnal esa "Xodim avanslari" ga ko'chdi. Agar biror
    // muhitda eski `SHEET_TAB_SALARIES=Xodim oyliklari` qolib ketsa,
    // solishtirish jurnal qatorlarini XULOSA varag'ining ustiga
    // yozib yuborardi va buni hech narsa sezmasdi. Endi u jimgina
    // buzish o'rniga BALAND OVOZDA to'xtaydi.
    //
    // Bo'sh sarlavha (yangi, hali to'ldirilmagan varaq) qabul qilinadi.
    const head = await readHeaderRow(cfg, spreadsheetId, tabName);
    if (head.length > 0 && head[0] !== headers[0]) {
      throw new Error(
        `"${tabName}" varag'ining sarlavhasi boshqa ("${head[0]}" != "${headers[0]}") — ` +
        `varaq nomi sozlamada noto'g'ri ko'rsatilgan bo'lishi mumkin (SHEET_TAB_*)`,
      );
    }
    // USTUN SONI YETARLIMI — sarlavhaga yangi ustun qo'shilganda.
    //
    // NIMA NOTO'G'RI EDI: `columnCount` faqat varaq YARATILAYOTGANDA
    // qo'yilardi (pastda `Math.max(headers.length, 10)`), mavjud varaqda
    // esa bu funksiya shu yerda darhol qaytardi. Sarlavhaga yangi ustun
    // qo'shilsa, o'sha ustun gridda UMUMAN BO'LMASDI: Google Sheets xato
    // bermaydi, qiymat shunchaki yozilmaydi — jim buzilish.
    //
    // O'lchandi: "Xodim oyliklari" varag'ida columnCount = 10, sarlavha
    // 9 ta. "Kartaga"/"Naqd" qo'shilishi bilan 11 ta bo'ladi va 11-ustun
    // (K) gridda yo'q edi.
    const cols = existing.properties.gridProperties?.columnCount ?? 0;
    if (cols > 0 && cols < headers.length) {
      await sheetsFetch(cfg, `${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: existing.properties.sheetId,
                  gridProperties: { columnCount: headers.length },
                },
                fields: "gridProperties.columnCount",
              },
            },
          ],
        }),
      });
    }
    // Sarlavha qatori ham yangilanadi — aks holda yangi ustunlar nomsiz
    // qolardi. Faqat UZUNLIK farq qilganda: matnni har safar qayta yozish
    // foydalanuvchi qo'lda o'zgartirgan sarlavhani bosib ketardi.
    if (head.length > 0 && head.length < headers.length) {
      await sheetsFetch(
        cfg,
        `${SHEETS_API}/${spreadsheetId}/values/${rangeParam(tabName, "A1")}?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values: [headers] }) },
      );
    }
    return { sheetId: existing.properties.sheetId, tabName };
  }

  const created = (await sheetsFetch(cfg, `${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: tabName,
              gridProperties: { frozenRowCount: 1, columnCount: Math.max(headers.length, 10) },
            },
          },
        },
      ],
    }),
  })) as { replies?: { addSheet?: { properties: { sheetId: number } } }[] };

  const sheetId = created.replies?.[0]?.addSheet?.properties.sheetId;
  if (typeof sheetId !== "number") throw new Error("Google varaq yaratilmadi");

  await sheetsFetch(
    cfg,
    `${SHEETS_API}/${spreadsheetId}/values/${rangeParam(tabName, "A1")}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: [headers] }) },
  );

  // Sarlavhani qalin qilib, fon berib qo'yamiz — jadval odam o'qiydigan
  // hujjat, faqat mashina uchun emas.
  await sheetsFetch(cfg, `${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.93, green: 0.94, blue: 0.96 },
              },
            },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
          },
        },
      ],
    }),
  });

  return { sheetId, tabName };
}

/**
 * Faqat SARLAVHA qatori (A1:Z1). `ensureTab` mavjud varaq to'g'ri
 * varaqmi-yo'qmi shuni tekshirishda ishlatadi.
 */
async function readHeaderRow(
  cfg: SyncConfig,
  spreadsheetId: string,
  tabName: string,
): Promise<string[]> {
  const data = (await sheetsFetch(
    cfg,
    `${SHEETS_API}/${spreadsheetId}/values/${rangeParam(tabName, "A1:Z1")}?majorDimension=ROWS`,
  )) as { values?: SheetCell[][] };
  return (data.values?.[0] ?? []).map((v) => String(v ?? "").trim());
}

/**
 * Varaqning ma'lumot qismini TO'LIQ almashtiradi: eskisini tozalab,
 * yangisini yozadi.
 *
 * Solishtirishdan (reconcile) FARQ QILADI va bu ataylab: u yerda har
 * qator bazadagi YOZUVGA teng va id bo'yicha topiladi. Bu yerda esa
 * qatorlar HISOB natijasi — kecha 14 ta o'qituvchi bo'lsa bugun 13 ta
 * bo'lishi mumkin, ya'ni "id bo'yicha yangilash" ma'nosiz. Butun blokni
 * qayta yozish yagona to'g'ri usul.
 */
export async function replaceRows(
  cfg: SyncConfig,
  spreadsheetId: string,
  tabName: string,
  rows: SheetCell[][],
): Promise<void> {
  await sheetsFetch(cfg, `${SHEETS_API}/${spreadsheetId}/values/${rangeParam(tabName, "A2:Z10000")}:clear`, {
    method: "POST",
    body: "{}",
  });
  if (rows.length === 0) return;
  // Oraliqning o'ng chegarasi "Z" — ustunlar soni har doim undan kam
  // (eng kengi 15 ta). Aniq harfni hisoblashning hojati yo'q: Google
  // berilgan qatorlar bo'yicha o'zi kesadi.
  await sheetsFetch(
    cfg,
    `${SHEETS_API}/${spreadsheetId}/values/${rangeParam(tabName, `A2:Z${rows.length + 1}`)}?${RAW}`,
    { method: "PUT", body: JSON.stringify({ values: rows }) },
  );
}

/**
 * Butun varaqni o'qiydi (sarlavhasiz). Solishtirish shu ma'lumot ustida
 * ishlaydi — ya'ni "Sheet'da nima bor" degan savolga bazadan emas, AYNAN
 * GOOGLE'DAN javob olinadi. Odam qo'lda o'zgartirgan bo'lsa ham shu yerda
 * ko'rinadi.
 */
export async function readRows(
  cfg: SyncConfig,
  spreadsheetId: string,
  tabName: string,
): Promise<SheetCell[][]> {
  // UNFORMATTED_VALUE — raqamlar Google formatlagan matn ("500 000,00")
  // emas, xom son bo'lib qaytadi. Aks holda solishtirishda bazadagi
  // 500000 bilan jadvaldagi "500 000,00" hech qachon teng chiqmasdi va
  // har kuni barcha qatorlar "o'zgargan" deb qayta yozilaverardi.
  const data = (await sheetsFetch(
    cfg,
    `${SHEETS_API}/${spreadsheetId}/values/${rangeParam(tabName, "A2:Z")}` +
      `?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
  )) as { values?: SheetCell[][] };
  return data.values || [];
}

/**
 * ID -> qator raqam(lar)i xaritasi. Qator raqami 1 dan boshlanadi,
 * sarlavha 1-qator, ya'ni ma'lumot 2-qatordan boshlanadi.
 *
 * Qator raqamini bazada SAQLAMAYMIZ: odam jadvalga qo'lda qator qo'shsa
 * yoki o'chirsa, saqlangan raqam yolg'onga aylanadi va biz noto'g'ri
 * qatorni yangilab yuborardik. Shuning uchun har amaldan oldin joriy
 * holat o'qiladi.
 *
 * Qiymat massiv — bir xil ID bir necha marta uchrashi mumkin (dublikat).
 * Solishtirish bosqichi ularni tozalaydi.
 */
export function buildIdIndex(rows: SheetCell[][]): Map<number, number[]> {
  const index = new Map<number, number[]>();
  rows.forEach((row, i) => {
    const id = Number(String(row[0] ?? "").trim());
    if (!Number.isFinite(id) || id <= 0) return;
    const rowNumber = i + 2; // sarlavha 1-qator
    const list = index.get(id);
    if (list) list.push(rowNumber);
    else index.set(id, [rowNumber]);
  });
  return index;
}

// valueInputOption=RAW — Google yuborilgan qiymatni TALQIN QILMAYDI:
// matn matnligicha, son songa aylanadi. USER_ENTERED bo'lganda "26.08.2026"
// sanaga aylantirilib, o'qiganda seriya raqami ("46261") bo'lib qaytardi va
// solishtirish har safar farq topib, qatorlarni bekorga qayta yozardi.
// Summa esa JS soni sifatida yuboriladi — jadvalda SUM() ishlaydi.
const RAW = "valueInputOption=RAW";

/**
 * Qatorlarni oxiriga qo'shadi va QAYSI QATORGA tushganini qaytaradi.
 * Qator raqami ID xaritasini yangilash uchun kerak: shu bilan bitta
 * partiya ichida qo'shilgan yozuv keyin bekor qilinsa, uni qidirib
 * yurmasdan to'g'ri qatorni yangilaymiz.
 */
export async function appendRows(
  cfg: SyncConfig,
  spreadsheetId: string,
  tabName: string,
  values: SheetCell[][],
): Promise<{ firstRow: number | null; count: number }> {
  if (values.length === 0) return { firstRow: null, count: 0 };
  const url =
    `${SHEETS_API}/${spreadsheetId}/values/${rangeParam(tabName, "A1")}:append` +
    `?${RAW}&insertDataOption=INSERT_ROWS`;
  const res = (await sheetsFetch(cfg, url, {
    method: "POST",
    body: JSON.stringify({ values }),
  })) as { updates?: { updatedRange?: string } };

  // updatedRange: "'To''lovlar'!A5:O7" -> birinchi qator 5
  const m = /![A-Z]+(\d+):/.exec(res.updates?.updatedRange || "");
  return { firstRow: m ? Number(m[1]) : null, count: values.length };
}

export async function updateRow(
  cfg: SyncConfig,
  spreadsheetId: string,
  tabName: string,
  rowNumber: number,
  values: SheetCell[],
): Promise<void> {
  const lastCol = String.fromCharCode(64 + Math.min(Math.max(values.length, 1), 26));
  const url =
    `${SHEETS_API}/${spreadsheetId}/values/` +
    `${rangeParam(tabName, `A${rowNumber}:${lastCol}${rowNumber}`)}?${RAW}`;
  await sheetsFetch(cfg, url, { method: "PUT", body: JSON.stringify({ values: [values] }) });
}

/**
 * Qatorlarni o'chiradi. Pastdan yuqoriga tartiblanadi — aks holda birinchi
 * o'chirish qolganlarining raqamini surib yuboradi va noto'g'ri qatorlar
 * o'chib ketardi.
 */
export async function deleteRows(
  cfg: SyncConfig,
  spreadsheetId: string,
  sheetId: number,
  rowNumbers: number[],
): Promise<void> {
  if (rowNumbers.length === 0) return;
  const sorted = [...new Set(rowNumbers)].sort((a, b) => b - a);
  await sheetsFetch(cfg, `${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: sorted.map((r) => ({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: r - 1, endIndex: r },
        },
      })),
    }),
  });
}
