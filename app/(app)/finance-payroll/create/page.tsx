import { redirect } from "next/navigation";

// Eski manzil. Oylik hisob-kitob endi bo'limning BOSH sahifasi
// (/finance-payroll), chiqarishlar tarixi esa /finance-payroll/history da.
// Bu yo'naltirish saqlangan havolalar va brauzer tarixi uchun qoldirilgan.
export default function Page() {
  redirect("/finance-payroll");
}
