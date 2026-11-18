import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import LeadSettingsV2 from "@/components/v2/settings/LeadSettingsV2";

// Sozlamalar → Lidlar → Lid sozlamalari (18.11.2026, 40-qism) — components/v2/settings/LeadSettingsV2.tsx.
// `?tab=royxatlar | teglar | maydonlar`.
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initialTab = tab === "teglar" || tab === "maydonlar" ? tab : "royxatlar";
  return (
    <SettingsFrameV2>
      <LeadSettingsV2 initialTab={initialTab} />
    </SettingsFrameV2>
  );
}
