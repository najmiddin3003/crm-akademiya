import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { ensureIndexes } from "./mongodb";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export interface CurrentUser {
  id: string;
  phone: string;
  fullName: string;
  role: string;
  /** Joriy qurilma sessiyasi (eski cookie'larda bo'lmasligi mumkin). */
  sid?: string;
}

// Joriy so'rovdagi sessiya cookie'sini tekshirib, DB'dagi jonli holatini
// o'qiydi. Sessiya imzosi to'g'ri bo'lsa ham, admin foydalanuvchini
// muzlatgan/bloklagan/o'chirgan bo'lsa null qaytadi — shu orqali (app)
// layout uni keyingi sahifada darhol chiqarib yuboradi.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session || !ObjectId.isValid(session.uid)) return null;

  const db = await ensureIndexes();
  const user = await db.collection("users").findOne({ _id: new ObjectId(session.uid) });
  if (!user || user.status !== "active") return null;

  // Qurilma sessiyasi uzilgan bo'lsa ("Aktiv qurilmalar" da chiqarilgan),
  // keyingi sahifa ochilishida foydalanuvchi chiqarib yuboriladi.
  // `sid` yo'q eski cookie'lar amal qilaveradi — pastdagi izohga qarang.
  if (session.sid) {
    const live = await db.collection("user_sessions").findOne({ sid: session.sid });
    if (!live) return null;
    // Oxirgi faollik vaqtini yangilaymiz — ro'yxatda ko'rsatiladi.
    const p = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    await db.collection("user_sessions").updateOne(
      { sid: session.sid },
      { $set: { lastSeenAt: `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}` } },
    );
  }

  return {
    id: user._id.toString(),
    phone: user.phone,
    fullName: user.fullName,
    role: user.role || "employee",
    sid: session.sid,
  };
}
