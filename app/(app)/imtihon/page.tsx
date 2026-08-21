import { Suspense } from "react";
import ImtihonPage from "@/components/imtihon/ImtihonPage";

// useSearchParams() Suspense chegarasini talab qiladi (tab holati `?tab=`da).
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ImtihonPage />
    </Suspense>
  );
}
