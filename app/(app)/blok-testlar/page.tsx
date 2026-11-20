import BlockTestExamsPage from "@/components/blockTest/BlockTestExamsPage";
import BlockTestExamsV2 from "@/components/v2/blockTest/BlockTestExamsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi Blok testlar
// (components/v2/blockTest/BlockTestExamsV2.tsx, 54-qism, 20.11.2026). Eski versiyada — avvalgi
// sahifa o'zgarmadi. API (/api/block-test-exams) va ruxsat bitta. Versiya serverda tanlanadi.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <BlockTestExamsV2 /> : <BlockTestExamsPage />;
}
