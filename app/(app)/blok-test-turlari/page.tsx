import BlockTestTypesPage from "@/components/blockTest/BlockTestTypesPage";
import BlockTestTypesV2 from "@/components/v2/blockTest/BlockTestTypesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi Blok test turlari
// (components/v2/blockTest/BlockTestTypesV2.tsx, 54-qism, 20.11.2026). Eski versiyada — avvalgi
// sahifa o'zgarmadi. API (/api/block-test-types) va ruxsat bitta. Versiya serverda tanlanadi.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <BlockTestTypesV2 /> : <BlockTestTypesPage />;
}
