import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { branchForInsert, getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { withLeadScope } from "@/lib/leadScope";
import { createOrder } from "@/lib/ordersCreate";
import type { NewOrderValues, Order } from "@/lib/ordersData";

// GET /api/orders — buyurtmalar ro'yxati, faqat bazadagi haqiqiy yozuvlar
// (demo/urug' ma'lumotlar bilan avtomatik to'ldirish endi yo'q — kolleksiya
// bo'sh bo'lsa, ro'yxat ham bo'sh qaytadi).
//
// FILIAL QAMROVI: navbardagi tanlov shu yerda ishlaydi (lib/branchScope.ts),
// ya'ni lid QAYSI filialda qo'shilgan bo'lsa, o'sha filial tanlanganda
// ko'rinadi. Ilgari ro'yxat kesilmasdi va filialni almashtirish lidlarga
// umuman ta'sir qilmasdi.
//
// Qamrov qoidasi bitta joyda — lib/leadScope.ts (u yerda nega aynan
// shunday ekani ham yozilgan): shu filialning lidlari, ustiga xodim O'ZI
// qo'shgan lidlar (filiali o'zgarsa ham ular yo'qolmaydi).
export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const col = db.collection("orders");
  const rows = await col
    .find(withLeadScope({}, scope, await currentAuthorName()))
    .sort({ id: -1 })
    .toArray();
  const orders: Order[] = rows.map(({ _id, ...rest }) => rest as Order);
  return NextResponse.json({ ok: true, orders });
}

// POST /api/orders — AddOrderModal'dan "Saqlash" bosilganda yangi buyurtma
// yaratadi. BUTUN MANTIQ lib/ordersCreate.ts da (id, filial ichidagi raqam,
// manba o'quvchi yozuvidan, Telegram lid topigi) — bu route faqat HTTP
// qobig'i: muallif sessiyadan, filial navbardagi tanlovdan. Xodimlar
// Telegram boti ham o'sha yadroni chaqiradi (lib/staffBot/lead.ts).
export async function POST(req: Request) {
  let body: NewOrderValues;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const out = await createOrder(
    db,
    body,
    { authorName: await currentAuthorName(), branchId: branchForInsert(scope) },
    // TELEGRAM — javobdan KEYIN (`after`): Telegram ishlamay qolgan paytda
    // lid QO'SHILMAY qolmasin (lib/ordersCreate.ts izohi).
    { defer: after },
  );
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, order: out.order });
}
