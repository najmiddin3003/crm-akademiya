import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// POST /api/auth/verify-token  { token }
// Taklif havolasi ochilganda tokenni tekshiradi. Amal qilsa — maskalangan
// telefonni qaytaradi (foydalanuvchiga "shu raqamni faollashtiryapsiz" deb ko'rsatish uchun).
export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const token = (body.token || "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Token yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const user = await db.collection("users").findOne({ "invite.token": token });

  if (!user || user.status !== "invited") {
    return NextResponse.json({ ok: false, error: "Havola yaroqsiz yoki allaqachon ishlatilgan" }, { status: 400 });
  }
  if (!user.invite?.expiresAt || new Date(user.invite.expiresAt) < new Date()) {
    return NextResponse.json({ ok: false, error: "Havola muddati tugagan. Administratordan qayta taklif so'rang." }, { status: 400 });
  }

  const phone: string = user.phone;
  const masked = `+${phone.slice(0, 5)}****${phone.slice(-2)}`;
  return NextResponse.json({ ok: true, phone: masked });
}
