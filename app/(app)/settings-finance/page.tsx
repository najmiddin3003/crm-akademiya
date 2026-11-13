import SettingsSectionPage from "@/components/settings/SettingsSectionPage";
import CashboxSettingsV2 from "@/components/v2/settings/CashboxSettingsV2";
import PaymentMethodsV2 from "@/components/v2/settings/PaymentMethodsV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// YANGI VERSIYA (13.11.2026, 24-qism): «Sozlamalar → Moliya»:
//   • `?tab=cashboxes` — Kassalar sozlamasi (mas'ul, filial, bosh kassa, arxiv; faqat admin
//     boshqaradi) — components/v2/settings/CashboxSettingsV2.tsx. Pul sahifasi (/finance-cash)
//     alohida va o'zgarmagan.
//   • `?tab=payment-methods` — To'lov turlari (tartib, holat, qabul qilgan kassalar) —
//     components/v2/settings/PaymentMethodsV2.tsx.
// Qolgan tablar va eski versiya — eski sahifa (unda `cashboxes` tabi yo'q — birinchi tab ochiladi).
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if ((tab === "cashboxes" || tab === "payment-methods") && (await currentUiVersion()) === "v2") {
    return (
      <SettingsFrameV2 current={`/settings-finance?tab=${tab}`}>
        {tab === "cashboxes" ? <CashboxSettingsV2 /> : <PaymentMethodsV2 />}
      </SettingsFrameV2>
    );
  }
  return <SettingsSectionPage sectionKey="finance" />;
}
