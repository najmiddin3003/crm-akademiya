import PublicResultsPage from "@/components/imtihon/PublicResultsPage";

// OCHIQ IMTIHON NATIJALARI — KALITSIZ MANZIL (01.11.2026). Natijalar endi faqat GURUH
// havolasi bilan ochiladi: /natijalar/<kalit> (app/natijalar/[kalit]/page.tsx; havola
// Imtihon → Sarhisob'dagi «Havolani nusxalash»dan). Bu yerda — «guruhingiz havolasini
// oching» yozuvi; avvalgi butun filial havolasi (/natijalar?filial=…&oy=…) ham shu yerga
// tushadi — boshqa guruhlar natijasi endi ko'rinmaydi.

export default function Page() {
  return <PublicResultsPage view="nolink" />;
}
