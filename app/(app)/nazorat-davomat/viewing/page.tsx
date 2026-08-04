import { Suspense } from "react";
import NazoratDavomatViewingPage from "@/components/nazorat/NazoratDavomatViewingPage";

// useSearchParams() Suspense chegarasini talab qiladi.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <NazoratDavomatViewingPage />
    </Suspense>
  );
}
