import MyCallsV2 from "@/components/v2/front/MyCallsV2";

// Moderator · Natijalarim (46-qism). `?as=ISM` — rahbar ko'rinishi.
export default async function Page({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  return <MyCallsV2 as={as?.trim() || undefined} />;
}
