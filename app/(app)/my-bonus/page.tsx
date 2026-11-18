import MyBonusV2 from "@/components/v2/account/MyBonusV2";

// «Bonusim» (18.11.2026, 39-qism) — xodimning o'z sotuv bonusi, telefon uchun (components/v2/account/MyBonusV2.tsx).
// `?name=` — direktor admin oynasini ko'radi (server faqat direktorga ruxsat beradi).
export default async function Page({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  return <MyBonusV2 name={typeof name === "string" && name.trim() ? name.trim() : undefined} />;
}
