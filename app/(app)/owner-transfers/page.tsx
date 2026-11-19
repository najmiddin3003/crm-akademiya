import { redirect } from "next/navigation";
import OwnerTransfersV2 from "@/components/v2/owner/OwnerTransfersV2";
import { requireAdmin } from "@/lib/adminOnly";

// Rahbar paneli · Ko'chirmalar (48-qism). Faqat Rahbar (admin).
export default async function Page() {
  if (!(await requireAdmin())) redirect("/home");
  return (
    <div data-ui="v2" className="p-4 font-v2 text-v2-text sm:p-6">
      <OwnerTransfersV2 />
    </div>
  );
}
