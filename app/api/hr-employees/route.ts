import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { EMPLOYEES_DATA } from "@/constants/employees";
import type { HrEmployee } from "@/lib/hrEmployees";

// Boshqaruv → Xodimlar backend'i (MongoDB `hr_employees`).
// Kolleksiya bo'sh bo'lsa — 49 ta demo xodimni bir marta seed qilamiz.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(EMPLOYEES_DATA)));
  }
}

function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("hr_employees");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  // `archDate` ("Sana" ustuni) keyin qo'shilgan — eski hujjatlarda yo'q,
  // shuning uchun bo'sh satrga to'ldiramiz (jadval `undefined` olmasligi uchun).
  const employees = rows.map(({ _id, ...rest }) => ({ archDate: "", ...rest }) as unknown as HrEmployee);
  return NextResponse.json({ ok: true, employees });
}

export async function POST(req: Request) {
  let body: Partial<HrEmployee>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Ism va familiyani kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("hr_employees");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const employee: HrEmployee = {
    id: nextId,
    name,
    gender: body.gender || "",
    aktivOq: 0,
    groups: 0,
    turi: body.turi || "",
    filial: body.filial || "Akademiya",
    phone: body.phone || "",
    kurs: body.kurs || "",
    created: fmtNow(new Date()),
    lastActive: "",
    archReason: "",
    archDate: "",
    email: body.email || "",
  };
  await col.insertOne({ ...employee });
  return NextResponse.json({ ok: true, employee });
}
