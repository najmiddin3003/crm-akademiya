import GroupSchedulePage from "@/components/groups/GroupSchedulePage";
import GroupScheduleV2 from "@/components/v2/groups/GroupScheduleV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi Dars jadvali
// (components/v2/groups/GroupScheduleV2.tsx, 54-qism, 20.11.2026: kun tablari, xona/o'qituvchi
// bo'yicha vaqt setkasi, telefon uchun ro'yxat). Eski versiyada — avvalgi jadval o'zgarmadi
// (/home ham o'sha eski komponentni `showStats` bilan ko'rsatadi). Versiya serverda tanlanadi —
// miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <GroupScheduleV2 /> : <GroupSchedulePage />;
}
