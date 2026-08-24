import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { HrEmployee } from "@/lib/hrEmployees";
import { isActiveModerator, moderatorFromEmployee, type Moderator } from "@/lib/moderatorsData";

// GET /api/moderators — faol moderatorlar ro'yxati (MongoDB `hr_employees`,
// `turi: "moderator"`, arxivlanmaganlar). Moderator tanlanadigan joylar
// (kassa paneli, lid filtrlari) shundan o'qiydi — /api/teachers bilan bir
// xil qolip.
export async function GET() {
  const db = await ensureIndexes();
  const rows = await db.collection("hr_employees").find({ turi: "moderator" }).sort({ name: 1 }).toArray();
  const moderators: Moderator[] = rows
    .map(({ _id, ...rest }) => rest as unknown as HrEmployee)
    .filter(isActiveModerator)
    .map(moderatorFromEmployee);
  return NextResponse.json({ ok: true, moderators });
}
