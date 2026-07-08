import { Suspense } from "react";
import ActivatePage from "@/components/auth/ActivatePage";

// useSearchParams() Suspense chegarasini talab qiladi.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ActivatePage />
    </Suspense>
  );
}
