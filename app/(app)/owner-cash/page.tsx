import { redirect } from "next/navigation";
import OwnerCashV2 from "@/components/v2/owner/OwnerCashV2";
import { requireAdmin } from "@/lib/adminOnly";

// Rahbar paneli · Rahbar kassasi (48-qism). Faqat Rahbar (admin).
export default async function Page() {
  if (!(await requireAdmin())) redirect("/home");
  return (
    <div data-ui="v2" className="p-4 font-v2 text-v2-text sm:p-6">
      <OwnerCashV2 />
    </div>
  );
}
