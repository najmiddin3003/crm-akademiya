import ContractsPage from "@/components/contracts/ContractsPage";
import ContractTemplatesV2 from "@/components/v2/academic/ContractTemplatesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi shartnoma andozalari
// ro'yxati (components/v2/academic/ContractTemplatesV2.tsx, 53-qism, 20.11.2026: ro'yxat, ko'rish
// oynasi, o'chirish). Eski versiyada — ContractsPage o'zgarmadi. Yaratish/tahrirlash ikkala
// versiyada ham o'sha /contract/add va /contract/[id]/edit (ContractFormPage). Ma'lumot bitta:
// /api/contracts. Versiya serverda tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <ContractTemplatesV2 /> : <ContractsPage />;
}
