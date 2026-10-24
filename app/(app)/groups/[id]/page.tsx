import { Suspense } from "react";
import GroupDetailPage from "@/components/groups/GroupDetailPage";
import GroupDetailV2 from "@/components/v2/groups/detail/GroupDetailV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Suspense SHART: GroupDetailPage tab holatini manzildan o'qiydi
// (`useSearchParams`), Next esa bunday komponentni Suspense chegarasisiz
// build paytida rad etadi.
//
// YANGI VERSIYA (24.10.2026, 10-qism): guruh yangi dizayndagi sahifada ochiladi
// (components/v2/groups/detail/GroupDetailV2.tsx, tablar `?tab=bugun|jurnal|oquvchilar`).
// Eski tab kalitlari: `students` → O'quvchilar, `attendance` → Davomat jurnali;
// qolganlari (`tasks`, `lesson`, `history`) va `?classic=1` — eski sahifa.

/** Eski tab kaliti → yangi sahifa tabi; yo'q — eski sahifa ochiladi. */
const V2_TAB_OF: Record<string, string> = {
  bugun: "bugun",
  jurnal: "jurnal",
  oquvchilar: "oquvchilar",
  students: "oquvchilar",
  attendance: "jurnal",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; classic?: string }>;
}) {
  const { id } = await params;
  const { tab, classic } = await searchParams;
  const v2Tab = !tab ? "bugun" : Object.hasOwn(V2_TAB_OF, tab) ? V2_TAB_OF[tab] : null;
  if (classic !== "1" && v2Tab && Number.isFinite(Number(id)) && (await currentUiVersion()) === "v2") {
    return <GroupDetailV2 id={Number(id)} initialTab={v2Tab} />;
  }
  return (
    <Suspense fallback={null}>
      <GroupDetailPage id={Number(id)} />
    </Suspense>
  );
}
