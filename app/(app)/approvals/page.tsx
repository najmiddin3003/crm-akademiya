import ApprovalsV2 from "@/components/v2/staffdesk/ApprovalsV2";

// Menejer · Tasdiq kutmoqda (47-qism). `?open=t:12` — ochiladigan so'rov; `?as=ISM` — rahbar ko'rinishi.
export default async function Page({ searchParams }: { searchParams: Promise<{ as?: string; open?: string }> }) {
  const { as, open } = await searchParams;
  return <ApprovalsV2 as={as?.trim() || undefined} openKey={open?.trim() || undefined} />;
}
