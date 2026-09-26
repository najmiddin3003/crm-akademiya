import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { studentBalanceMatch } from "@/lib/studentRefund";
import { pupilNameOfDoc } from "@/lib/pupilEntries";
import { ENTRY_PAID_EXPR } from "@/lib/transactionEntries";

// GET /api/students/balances — har bir o'quvchining balansi.
//
// JAVOBDA XARITALAR:
//   `byId`     — `pupils.id` → summa. ASOSIYSI. Ismdoshlar ajraladi.
//   `balances` — kichik harfli ism → summa. Eski kalit; id'si yo'q
//                joylar (masalan jurnaldagi xom ism) uchun qoldi.
//   `discountById` — shu summaning TANGA EVAZIGA CHEGIRMA qismi (faqat
//                bori). Summa = naqd + chegirma (lib/transactionEntries.ts →
//                discountSom); pul QAYTARISH chegarasi esa faqat naqd —
//                Chiqim oynasi `byId − discountById` ni oladi.
// Nega ikkitasi va qoida qayerdan: lib/pupilEntries.ts.
//
// Manba: `transaction_entries` — o'quvchi qilgan to'lovlar (payIn) MINUS
// unga qaytarib berilgan pul (payOut + `studentRefund: true`), bekor
// qilinganlarsiz. Shart BITTA joyda — lib/studentRefund.ts →
// studentBalanceMatch (lib/pupilsDb.ts ham aynan shuni ishlatadi, ya'ni
// balans ikki joyda ikki xil chiqmaydi). Kassalardagi "Kirim" va "Chiqim"
// oynalarida o'quvchi tanlanayotganda uning balansi ko'rsatiladi.
//
// DIQQAT: bu TO'LANGAN pul yig'indisi. Tizimda o'quvchining to'lashi kerak
// bo'lgan summa (dars narxi × dars soni) yuritilmaydi, shuning uchun
// "qarzdorlik" hisoblab bo'lmaydi va o'ylab topilmaydi ham.
export async function GET() {
  const db = await ensureIndexes();
  // Yig'indi MONGO'da hisoblanadi. Ilgari 16 937 qator Node'ga kelib,
  // pastdagi tsikl ularni shu yerda qo'shardi — natija esa atigi ~3 264 ta
  // kalit, ya'ni kelgan qatorlarning ~80% i allaqachon xaritada bor kalit
  // edi. O'lchandi: 1 167 ms → ~480 ms, 899 KB → ~140 KB.
  //
  // Guruhlash XOM `studentName` bo'yicha ketadi, kichik harfga o'tkazish
  // esa pastda, JS'da qoladi. Bu ataylab: bazada chetida bo'shliq bor 15 ta
  // yozuv va katta-kichik harfi farq qiladigan 38 ta ism juftligi bor —
  // ular AYNAN shu `trim().toLowerCase()` orqali birlashadi. Mongo'da
  // `$toLower` bilan guruhlash o'zbek harflarida boshqacha ishlashi
  // mumkin, shuning uchun qoida bir joyda — JS'da — qoladi.
  const rows = await db
    .collection("transaction_entries")
    .aggregate([
      // Qaytarim yozuvi MANFIY summa bilan turadi — ishorali yig'indi uni
      // o'z-o'zidan ayiradi.
      { $match: studentBalanceMatch() },
      // ID bo'yicha ham, ism bo'yicha ham guruhlanadi — pastda ikkalasi
      // ikki xil xaritaga ajratiladi.
      {
        $group: {
          _id: { pupilId: "$pupilId", name: "$studentName" },
          total: { $sum: ENTRY_PAID_EXPR },
          discount: { $sum: { $ifNull: ["$discountSom", 0] } },
        },
      },
    ])
    .toArray();

  // ISM BO'YICHA — eski xarita, o'zgarishsiz qoladi. Uni hali id'siz
  // chaqiradigan joylar bor (masalan jurnaldagi xom ism), shu bois
  // olib tashlanmadi.
  const balances: Record<string, number> = {};
  // ID BO'YICHA — asosiy xarita (lib/pupilEntries.ts). `pupilId` bor
  // yozuv FAQAT shu yerga tushadi va ismdoshga ko'rinmaydi.
  const byId: Record<number, number> = {};
  // `pupilId` SIZ eski yozuvlar — ism bo'yicha. Ular pastda o'sha ismli
  // o'quvchi(lar)ga qo'shiladi, ya'ni bugungi xatti-harakat saqlanadi:
  // belgilanmagan eski to'lov ismdoshlarda baribir umumiy ko'rinadi.
  // Backfill (scripts/backfill-entry-pupil-id.mjs) bu qoldiqni kamaytiradi.
  const legacyByName: Record<string, number> = {};
  // Chegirma faqat `pupilId` li yozuvda bo'ladi (kirim yadrosi o'quvchi
  // aniqlangandagina qo'llaydi) — eski ism bo'yicha shoxga kerak emas.
  const discountById: Record<number, number> = {};

  for (const r of rows) {
    const total = Number(r.total) || 0;
    const key = String(r._id?.name ?? "").trim().toLowerCase();
    if (key) balances[key] = (balances[key] ?? 0) + total;

    const pid = Number(r._id?.pupilId);
    if (Number.isFinite(pid)) {
      byId[pid] = (byId[pid] ?? 0) + total;
      const disc = Number(r.discount) || 0;
      if (disc) discountById[pid] = (discountById[pid] ?? 0) + disc;
    } else if (key) legacyByName[key] = (legacyByName[key] ?? 0) + total;
  }

  // Eski yozuvlar egasiga ulanadi. `pupils` ro'yxati yengil o'qiladi
  // (id + ism) — 7 130 hujjat, atigi ~0.2 MB.
  //
  // Belgilanmagan yozuv QOLMAGANDA (migratsiya to'liq o'tgach) bu so'rov
  // umuman ketmaydi: ulanadigan hech narsa yo'q.
  const pupils = Object.keys(legacyByName).length === 0 ? [] : await db
    .collection("pupils")
    .find({}, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } })
    .toArray();
  for (const p of pupils) {
    const id = Number(p.id);
    if (!Number.isFinite(id)) continue;
    const key = pupilNameOfDoc(p).toLowerCase();
    const legacy = key ? legacyByName[key] ?? 0 : 0;
    if (legacy !== 0 || byId[id] !== undefined) byId[id] = (byId[id] ?? 0) + legacy;
  }

  return NextResponse.json({ ok: true, balances, byId, discountById });
}
