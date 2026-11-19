import { redirect } from "next/navigation";
import OwnerApprovalsV2 from "@/components/v2/owner/OwnerApprovalsV2";
import { requireAdmin } from "@/lib/adminOnly";

// Rahbar paneli · Tasdiqlar (48-qism). Faqat Rahbar (admin). `?open=a:12` — ochiladigan so'rov.
export default async function Page({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  if (!(await requireAdmin())) redirect("/home");
  const { open } = await searchParams;
  return (
    <div data-ui="v2" className="p-4 font-v2 text-v2-text sm:p-6">
      <OwnerApprovalsV2 openKey={open?.trim() || undefined} />
    </div>
  );
}
