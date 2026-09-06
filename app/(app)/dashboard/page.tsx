// ESKI MANZIL. Bosh sahifa "/home" ga ko'chirildi — bu route faqat eski
// havolalar va brauzer xatcho'plari buzilmasligi uchun qoldirilgan.
//
// Sahifaning o'zi app/(app)/home/page.tsx da.
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/home");
}
