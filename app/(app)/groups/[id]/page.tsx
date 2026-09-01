import { Suspense } from "react";
import GroupDetailPage from "@/components/groups/GroupDetailPage";

// Suspense SHART: GroupDetailPage tab holatini manzildan o'qiydi
// (`useSearchParams`), Next esa bunday komponentni Suspense chegarasisiz
// build paytida rad etadi.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <GroupDetailPage id={Number(id)} />
    </Suspense>
  );
}
