import TransactionTypesPage from "@/components/finance/TransactionTypesPage";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import TransactionTypesV2 from "@/components/v2/settings/TransactionTypesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Sozlamalar → Moliya → Kirim-chiqim toifalari» (Sozlamalar ramkasi ichida,
// components/v2/settings/TransactionTypesV2.tsx, 20.11.2026): o'sha /api/transaction-types,
// qo'shish/tahrirlash — oynada. Eski versiyada — Moliya → Tranzaksiya turi o'zgarmagan
// (qo'shish/tahrirlash /finance-tx-types/add va /[id]/edit sahifalarida).
export default async function Page() {
  if ((await currentUiVersion()) === "v2") {
    return (
      <SettingsFrameV2 current="/finance-tx-types">
        <TransactionTypesV2 />
      </SettingsFrameV2>
    );
  }
  return <TransactionTypesPage />;
}
