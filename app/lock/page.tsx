import { redirect } from "next/navigation";
import LockScreen from "@/components/auth/LockScreen";
import { getCurrentUser } from "@/lib/auth";

// Qulflangan ekran. (app) guruhidan TASHQARIDA — sidebar/navbar chiqmaydi.
// Bu yerga faqat middleware yo'naltiradi (qulf cookie'si bor bo'lsa).
export default async function LockPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/force-logout");
  return <LockScreen fullName={user.fullName} phone={user.phone} />;
}
