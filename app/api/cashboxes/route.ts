import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox, zeroMethodTotals, type Cashbox } from "@/lib/cashboxes";
import { loadPaymentMethodKeys } from "@/lib/paymentMethods";
import { getCurrentEmployee, nameEq } from "@/lib/currentEmployee";
import { getBranchScope, withBranch } from "@/lib/branchScope";

// Moliya → Kassalar backend'i (MongoDB `cashboxes`). Demo seed YO'Q —
// kassalarni foydalanuvchi o'zi qo'shadi.
//
// GET /api/cashboxes          — kassalar (pul bilan), QAMROV cheklangan
// GET /api/cashboxes?names=1  — faqat [{ id, name }], cheklovsiz
//
// QAMROV: admin hammasini ko'radi, xodim esa faqat O'ZIGA biriktirilganini
// (`cashboxes.moderator` — uning `hr_employees.name` i). Kassa — shaxsiy
// javobgarlik obyekti: unda kimning puli borligi va qancha ekani faqat
// egasiga va adminga tegishli. Ilgari bu yerda `col.find({})` turardi va
// `/finance-cash` ruxsati tekkan har kim uchala kassaning balansini ham,
// 25 581 qatorlik daftarini ham ochib ko'ra olardi.
//
// `?names=1` — kassa NOMLARI xaritasi (id → nom) uchun. Uni tranzaksiya
// jadvallari, hisobotlar va cheklar ishlatadi: qatorda boshqa kassaning
// yozuvi ko'rinishi mumkin va uning nomi bo'sh qolmasligi kerak. Bu
// javobda balans ham, moderator ham YO'Q, ya'ni pul oshkor bo'lmaydi.
export async function GET(req: Request) {
  const db = await ensureIndexes();
  const col = db.collection("cashboxes");

  if (new URL(req.url).searchParams.get("names") === "1") {
    const rows = await col.find({}, { projection: { id: 1, name: 1, archived: 1, _id: 0 } }).sort({ id: 1 }).toArray();
    return NextResponse.json({ ok: true, cashboxes: rows });
  }

  const me = await getCurrentEmployee();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  }
  // Kassaga biriktirilmagan xodim hech qanday kassa ko'rmaydi. Sahifada
  // buning uchun alohida bo'sh holat matni bor (CashboxesPage) — aks holda
  // bo'sh ekran "sayt buzildi" deb tushunilardi.
  if (!me.isAdmin && !me.name) {
    return NextResponse.json({ ok: true, cashboxes: [] });
  }

  // FILIAL QAMROVI — FAQAT ADMIN uchun.
  //
  // Admin uchun navbardagi filial tanlovi shu ro'yxatni FILTRLAYDI:
  // "Akademiya 2 Chortoq" tanlansa o'sha filialning kassasi ko'rinadi.
  // Kassa qaysi filialga tegishli ekani `cashboxes.branchId` da.
  //
  // XODIMGA QO'LLANMAYDI — ATAYLAB. Uning ro'yxati allaqachon `moderator`
  // bo'yicha kesilgan, ya'ni u eng ko'pi bitta — O'ZINING — kassasini
  // ko'radi. Ustiga filial sharti qo'yilsa, xodimning filiali bilan
  // kassaning filiali bir lahzaga mos kelmay qolgan paytda (masalan biri
  // ko'chirilib, ikkinchisi hali ko'chirilmaganda) kassir O'Z kassasini
  // ham ko'rmay qolardi va sabab hech qayerda ko'rinmasdi. Aynan shunday
  // holat bu loyihada bir marta bo'lgan.
  const scope = me.isAdmin ? await getBranchScope() : null;
  const filter = me.isAdmin ? {} : { moderator: nameEq(me.name!) };

  // Ikkala o'qish bir-biriga bog'liq emas -> bitta round-trip'da.
  const [keys, rows] = await Promise.all([
    loadPaymentMethodKeys(db),
    col.find(scope ? withBranch(filter, scope) : filter).sort({ id: 1 }).toArray(),
  ]);
  const cashboxes = rows.map(({ _id, ...rest }) => normalizeCashbox({ isPrimary: false, ...rest }, keys));
  return NextResponse.json({ ok: true, cashboxes });
}

export async function POST(req: Request) {
  let body: Partial<Cashbox>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Kassa nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("cashboxes");

  // Bitta moderator — bitta kassa. Oynada band moderatorlar hira turadi,
  // ammo tekshiruv shu yerda ham kerak: aks holda so'rovni to'g'ridan-to'g'ri
  // yuborib ikkita kassaga bir odamni biriktirib qo'yish mumkin bo'lardi.
  const moderator = (body.moderator || "").trim();
  if (moderator) {
    const taken = await col.findOne({ moderator });
    if (taken) {
      return NextResponse.json(
        { ok: false, error: `${moderator} allaqachon "${taken.name}" kassasiga biriktirilgan` },
        { status: 400 },
      );
    }
  }

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const cashbox: Cashbox = {
    id: nextId,
    name,
    balance: 0,
    moderator,
    onlinePayment: !!body.onlinePayment,
    archived: !!body.archived,
    isPrimary: false,
    methodTotals: zeroMethodTotals(await loadPaymentMethodKeys(db)),
  };
  await col.insertOne({ ...cashbox });
  return NextResponse.json({ ok: true, cashbox });
}
