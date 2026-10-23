import { Suspense } from "react";
import ImtihonPage from "@/components/imtihon/ImtihonPage";
import ImtihonV2 from "@/components/v2/imtihon/ImtihonV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// useSearchParams() Suspense chegarasini talab qiladi (tab holati `?tab=`da).
// Yangi versiyada (cookie `tizimli_ui`) — yangi dizayndagi Imtihon
// (components/v2/imtihon/ImtihonV2.tsx, 23.10.2026: Sarhisob ro'yxati va «Natija
// kiritish»); ikkalasi bitta yadrodan (components/imtihon/sarhisobCore.ts).
export default async function Page() {
  const v2 = (await currentUiVersion()) === "v2";
  return <Suspense fallback={null}>{v2 ? <ImtihonV2 /> : <ImtihonPage />}</Suspense>;
}
