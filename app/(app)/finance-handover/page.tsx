import DailyHandoverV2 from "@/components/v2/finance/DailyHandoverV2";

// Moliya → Kunlik topshiruv (yangi versiya, 32-qism, 16.11.2026). Eski versiyada bunday sahifa yo'q edi —
// o'xshash hisobot Kassalar → rahbar kartochkasidagi «Kunlik topshiruv» oynasida. Sahifa ikkala
// versiyada ham shu ko'rinishda (yangi qobiq ichida yoki eski).
export default function Page() {
  return <DailyHandoverV2 />;
}
