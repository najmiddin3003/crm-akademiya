import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { decryptSecret } from "@/lib/crypto";

// GET /api/employees/:id/password
// Admin yangi parol o'rnatishdan oldin xodimning joriy parolini ko'rishi
// uchun. Hali faollashtirilmagan (invited) xodimda parol yo'q — null qaytadi.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const employee = await db.collection("employees").findOne({ _id: new ObjectId(id) });
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }

  const user = await db.collection("users").findOne({ employeeId: employee._id });
  const password = user?.passwordEnc ? decryptSecret(user.passwordEnc) : null;

  return NextResponse.json({ ok: true, password });
}
