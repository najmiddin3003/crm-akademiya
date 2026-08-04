import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { SA_STUDENTS, SA_COURSES, SA_SUPPORT_TEACHERS, SA_TOTAL, SA_DAYS } from "@/constants/supportAnalytics";
import type { SupportRecord } from "@/lib/supportAnalytics";

// Nazorat → Support analitikasi backend'i (MongoDB `support_analytics`).
// Bo'sh bo'lsa demo yozuvlarni seed qiladi — loyihadagi boshqa Nazorat
// ma'lumotlari kabi deterministik LCG bilan.

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildSeed(): SupportRecord[] {
  const today = new Date();
  const rows: SupportRecord[] = [];

  for (let i = 1; i <= SA_TOTAL; i++) {
    let seed = i * 9301 + 49297;
    const rnd = (min: number, max: number) => {
      seed = (seed * 9301 + 49297) % 233280;
      return Math.floor((seed / 233280) * (max - min + 1)) + min;
    };

    const dayOffset = rnd(0, SA_DAYS - 1);
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset);

    rows.push({
      id: i,
      studentName: SA_STUDENTS[rnd(0, SA_STUDENTS.length - 1)],
      courseName: SA_COURSES[rnd(0, SA_COURSES.length - 1)],
      supportTeacherName: SA_SUPPORT_TEACHERS[rnd(0, SA_SUPPORT_TEACHERS.length - 1)],
      date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
      time: `${pad2(rnd(9, 19))}:${pad2(rnd(0, 59))}`,
      writtenCount: rnd(1, 24),
    });
  }

  return rows;
}

async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(buildSeed().map((r) => ({ ...r })));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("support_analytics");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ date: -1, id: -1 }).toArray();
  const records = rows.map(({ _id, ...rest }) => rest as unknown as SupportRecord);
  return NextResponse.json({ ok: true, records });
}
