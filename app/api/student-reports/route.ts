import { NextResponse } from "next/server";
import type { Collection, Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { createInitialOrders } from "@/lib/ordersData";
import type {
  CancelledAttendance,
  CancelledPayment,
  LeaveReason,
  PriceDifference,
  StudentDiscount,
  UnpaidStudent,
} from "@/lib/studentReports";

// Hisobotlar bo'limidagi o'quvchi to'lov/davomat hisobotlarining backend'i.
//
// Bitta route, `?kind=` bilan — beshta hisobot ham bir xil shaklga ega
// (kichik, faqat o'qish uchun ro'yxat) va ularni alohida route'larga
// bo'lish faqat takrorlanadigan kod berardi.
//
// Seed `createInitialOrders()` dan quriladi — haqiqiy o'quvchi/guruh/kurs/
// o'qituvchi nomlari, shuning uchun hisobotlar loyihaning qolgan qismi
// bilan izchil. LCG deterministik: bir xil kirish → bir xil natija.

const KINDS = {
  unpaid: "unpaid_students",
  "price-diff": "price_differences",
  "cancelled-payments": "cancelled_payments",
  discounts: "student_discounts",
  "cancelled-attendance": "cancelled_attendance",
  "leave-reasons": "leave_reasons",
} as const;

type Kind = keyof typeof KINDS;

function makeRnd(seed0: number) {
  let seed = (seed0 * 7919 + 104729) % 233280;
  const rnd = (min: number, max: number) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * (max - min + 1)) + min;
  };
  for (let w = 0; w < 6; w++) rnd(0, 1);
  return rnd;
}

function buildSeed(kind: Kind): Record<string, unknown>[] {
  const orders = createInitialOrders();
  // Ismi va guruhi bor buyurtmalar — hisobot qatorlari uchun manba.
  const pool = orders.filter((o) => o.name && o.course);

  if (kind === "leave-reasons") {
    const reasons = ["Boshqa sabab", "Moliyaviy qiyinchilik", "Joyi uzoq", "Vaqti to'g'ri kelmadi", "Boshqa markazga o'tdi"];
    const cats: LeaveReason["category"][] = ["umumiy", "buyurtmadan", "tolovsiz", "tolovli"];
    const rows: LeaveReason[] = [];
    let id = 0;
    cats.forEach((category, ci) => {
      reasons.forEach((reason, ri) => {
        const rnd = makeRnd((ci + 1) * 31 + (ri + 1) * 17);
        id += 1;
        rows.push({ id, category, reason, count: rnd(0, ci === 0 ? 12 : 6) });
      });
    });
    return rows as unknown as Record<string, unknown>[];
  }

  const take = (n: number) => pool.slice(0, n);

  if (kind === "unpaid") {
    return take(49).map((o, i) => {
      const rnd = makeRnd(i + 1);
      const lessons = rnd(1, 6);
      return {
        id: i + 1,
        studentName: o.name,
        groups: o.group || String(rnd(1, 150)),
        unpaidLessons: lessons,
        totalUnpaid: lessons * rnd(4, 12) * 25000,
      } satisfies UnpaidStudent;
    }) as unknown as Record<string, unknown>[];
  }

  if (kind === "price-diff") {
    return take(18).map((o, i) => {
      const rnd = makeRnd(i + 101);
      const coursePrice = rnd(8, 12) * 25000;
      const isDiscount = rnd(0, 1) === 0;
      return {
        id: i + 1,
        studentName: o.name,
        type: isDiscount ? "Chegirma" : "Qo'shimcha",
        group: o.group || String(rnd(1, 150)),
        studentPrice: isDiscount ? coursePrice - rnd(1, 4) * 25000 : coursePrice + rnd(1, 3) * 25000,
        coursePrice,
        createdAt: o.created.split(" ")[0],
      } satisfies PriceDifference;
    }) as unknown as Record<string, unknown>[];
  }

  if (kind === "cancelled-payments") {
    return take(15).map((o, i) => {
      const rnd = makeRnd(i + 201);
      const lessons = rnd(1, 29);
      return {
        id: i + 1,
        studentName: o.name,
        unpaidLessons: lessons,
        totalAmount: lessons * rnd(9, 11) * 25000,
        teacher: o.teacher || "—",
        group: o.group || String(rnd(1, 50)),
        note: rnd(0, 4) === 0 ? "guruh o'zgardi" : "",
      } satisfies CancelledPayment;
    }) as unknown as Record<string, unknown>[];
  }

  if (kind === "discounts") {
    return take(22).map((o, i) => {
      const rnd = makeRnd(i + 301);
      return {
        id: i + 1,
        studentName: o.name,
        course: o.course,
        group: o.group || String(rnd(1, 150)),
        totalDiscount: rnd(0, 8) * 25000,
        bonus: rnd(0, 3) * 50000,
      } satisfies StudentDiscount;
    }) as unknown as Record<string, unknown>[];
  }

  // cancelled-attendance
  return take(6).map((o, i) => {
    const rnd = makeRnd(i + 401);
    return {
      id: i + 1,
      studentName: o.name,
      amount: rnd(1, 11) * 25000,
      group: o.group || String(rnd(1, 150)),
      course: o.course,
      cancelledBy: o.moderator || o.teacher || "—",
      date: o.created.split(" ")[0],
    } satisfies CancelledAttendance;
  }) as unknown as Record<string, unknown>[];
}

async function seedIfEmpty(col: Collection, kind: Kind) {
  if ((await col.countDocuments()) === 0) {
    const rows = buildSeed(kind);
    if (rows.length > 0) await col.insertMany(rows.map((r) => ({ ...r })));
  }
}

async function loadRows(db: Db, kind: Kind) {
  const col = db.collection(KINDS[kind]);
  await seedIfEmpty(col, kind);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  return rows.map(({ _id, ...rest }) => rest);
}

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") as Kind | null;
  if (!kind || !(kind in KINDS)) {
    return NextResponse.json(
      { ok: false, error: `Noto'g'ri "kind" — ruxsat etilganlar: ${Object.keys(KINDS).join(", ")}` },
      { status: 400 },
    );
  }
  const db = await ensureIndexes();
  const rows = await loadRows(db, kind);
  return NextResponse.json({ ok: true, rows });
}
