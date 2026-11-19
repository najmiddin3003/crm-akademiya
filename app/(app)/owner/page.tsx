import { redirect } from "next/navigation";
import OwnerOverviewV2 from "@/components/v2/owner/OwnerOverviewV2";
import { requireAdmin } from "@/lib/adminOnly";

// Rahbar paneli · Umumiy ko'rinish (48-qism). Faqat Rahbar (admin) — menyuda `adminOnly`, API ham tekshiradi.
// Eski versiyada ham shu ko'rinish (v2 tokenlari `data-ui="v2"` ichida ishlaydi).
export default async function Page() {
  if (!(await requireAdmin())) redirect("/home");
  return (
    <div data-ui="v2" className="p-4 font-v2 text-v2-text sm:p-6">
      <OwnerOverviewV2 />
    </div>
  );
}
