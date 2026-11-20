import NazoratMissedGroupsPage from "@/components/nazorat/NazoratMissedGroupsPage";
import NazoratMissedGroupsV2 from "@/components/v2/nazorat/NazoratMissedGroupsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Nazorat → Davomat qilinmagan guruhlar. Yangi versiyada (28-qism, 20.11.2026) — ro'yxat qolipi
// (components/v2/nazorat/NazoratMissedGroupsV2.tsx); hisob va eski versiya o'zgarmadi. Versiya serverda tanlanadi.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <NazoratMissedGroupsV2 /> : <NazoratMissedGroupsPage />;
}
