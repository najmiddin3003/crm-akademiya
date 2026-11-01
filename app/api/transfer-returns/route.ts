import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { employeeNameById, nameEq } from "@/lib/currentEmployee";
import { isPathAllowed } from "@/lib/permissions";
import type { TransactionEntry } from "@/lib/transactionEntries";
import type { TransferReturnItem } from "@/lib/transferReturns";

// «PUL QAYTDI» OYNASI (01.11.2026) — jo'natuvchi kassa egasiga: rahbar
// ko'chirmani bekor qildi (tasdiqlamasdan yoki qabul qilgandan keyin), pul
// kassasiga qaytdi. Oyna qobiqda (components/shared/TransferReturnNotice.tsx),
// ya'ni HAR BIR sahifada — shu bois route SHARED_API da (sessiya yetarli) va
// qamrov SHU YERDA kesiladi (memory: qobiq-api-route):
//   • «/finance-cash» ruxsati yo'q — `state: "off"` (kassasiga kira olmaydi);
//   • xodimga kassa biriktirilmagan — `state: "no-cashbox"` (oyna so'rashni to'xtatadi);
//   • faqat O'Z kassalari — `cashboxes.moderator` ismi bo'yicha (GET
//     /api/cashboxes bilan bir xil qoida, admin uchun ham: admin barcha
//     kassalarni ko'radi, lekin xabar faqat o'zi mas'ul kassaga).
//
// Manba — ko'chirmaning "out" qatoridagi `returnUnseen` bayrog'i
// (lib/transferDecision.ts qo'yadi; qisman indeks lib/mongodb.ts da).
//
// GET  — ko'rilmaganlar (eng yangisi birinchi). HECH NARSA YOZMAYDI.
// POST — `{ seen: number[] }` («Tushunarli»): bayroq o'chadi, kim/qachon ko'rgani yoziladi.

const MAX_ITEMS = 20;

type Scope =
  | { state: "off" | "no-cashbox" }
  | { state: "on"; name: string; cashboxIds: number[]; names: Map<number, string> };

async function scopeOf(db: Db, me: CurrentUser): Promise<Scope> {
  if (!isPathAllowed("/finance-cash", me.permissions)) return { state: "off" };
  const name = await employeeNameById(db, me.hrEmployeeId);
  if (!name) return { state: "no-cashbox" };
  const boxes = await db
    .collection("cashboxes")
    .find({ moderator: nameEq(name) }, { projection: { _id: 0, id: 1, name: 1 } })
    .toArray();
  if (boxes.length === 0) return { state: "no-cashbox" };
  return {
    state: "on",
    name,
    cashboxIds: boxes.map((b) => Number(b.id)),
    names: new Map(boxes.map((b) => [Number(b.id), String(b.name ?? "")])),
  };
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  const scope = await scopeOf(db, me);
  if (scope.state !== "on") return NextResponse.json({ ok: true, state: scope.state, items: [] });

  const entries = db.collection("transaction_entries");
  const rows = (await entries
    .find({ returnUnseen: true, cashboxId: { $in: scope.cashboxIds }, transferRole: "out" }, { projection: { _id: 0 } })
    .sort({ returnedAt: -1 })
    .limit(MAX_ITEMS)
    .toArray()) as unknown as TransactionEntry[];
  if (rows.length === 0) return NextResponse.json({ ok: true, state: "on", items: [] });

  // Pul QAYSI kassaga jo'natilgan edi — juftlikning "in" qatoridan.
  const transferIds = rows.map((r) => r.transferId).filter((x): x is number => typeof x === "number");
  const inRows = await entries
    .find({ transferId: { $in: transferIds }, transferRole: "in" }, { projection: { _id: 0, transferId: 1, cashboxId: 1 } })
    .toArray();
  const toBoxByTransfer = new Map(inRows.map((r) => [Number(r.transferId), Number(r.cashboxId)]));
  const otherIds = [...new Set([...toBoxByTransfer.values()].filter((id) => !scope.names.has(id)))];
  const others = otherIds.length
    ? await db.collection("cashboxes").find({ id: { $in: otherIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()
    : [];
  const boxName = new Map(scope.names);
  for (const c of others) boxName.set(Number(c.id), String(c.name ?? ""));

  const items: TransferReturnItem[] = rows.map((r) => {
    const toId = typeof r.transferId === "number" ? toBoxByTransfer.get(r.transferId) : undefined;
    return {
      id: r.id,
      amount: Math.abs(Number(r.amount) || 0),
      method: r.paymentType || "",
      fromCashbox: boxName.get(r.cashboxId) ?? "",
      toCashbox: toId !== undefined ? (boxName.get(toId) ?? "") : "",
      sentDate: r.date || "",
      sentTime: r.time || "",
      note: r.note || "",
      returnedAt: r.returnedAt || "",
      returnedBy: r.returnedBy || "",
      comment: r.returnComment || "",
      afterConfirm: r.returnedAfterConfirm === true,
    };
  });
  return NextResponse.json({ ok: true, state: "on", items });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { seen?: unknown } | null;
  const ids = Array.isArray(body?.seen)
    ? [...new Set(body.seen.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 100)
    : [];
  if (ids.length === 0) return NextResponse.json({ ok: false, error: "Ro'yxat bo'sh" }, { status: 400 });

  const db = await ensureIndexes();
  const scope = await scopeOf(db, me);
  if (scope.state !== "on") return NextResponse.json({ ok: true, n: 0 });

  // Faqat O'Z kassasidagi qator — begona id yuborilsa jimgina o'tkazib yuboriladi.
  const res = await db.collection("transaction_entries").updateMany(
    { id: { $in: ids }, returnUnseen: true, cashboxId: { $in: scope.cashboxIds }, transferRole: "out" },
    { $unset: { returnUnseen: "" }, $set: { returnSeenAt: new Date().toISOString(), returnSeenBy: scope.name } },
  );
  return NextResponse.json({ ok: true, n: res.modifiedCount });
}
