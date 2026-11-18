import CallQueueV2 from "@/components/v2/front/CallQueueV2";

// Moderator · Qo'ng'iroq navbati (46-qism). `?as=ISM` — rahbar ko'rinishi. Kim ekani serverda (/api/front, lib/frontDesk.ts).
export default async function Page({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  return <CallQueueV2 as={as?.trim() || undefined} />;
}
