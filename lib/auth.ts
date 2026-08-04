import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { ensureIndexes } from "./mongodb";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export interface CurrentUser {
  id: string;
  phone: string;
  fullName: string;
  role: string;
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

  return {
    id: user._id.toString(),
    phone: user.phone,
    fullName: user.fullName,
    role: user.role || "employee",
  };
}
