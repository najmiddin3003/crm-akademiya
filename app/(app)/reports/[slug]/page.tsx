import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isPathAllowed } from "@/lib/permissions";
import { REPORT_BY_SLUG, canOpenReport, type ReportSlug } from "@/lib/reportsCatalog";
import ReportView from "@/components/v2/reports/ReportView";
import { shortPersonName } from "@/components/v2/reports/reportFormat";

// HISOBOT SAHIFASI (yangi versiya, 15-qism, 25.10.2026): `/reports/<slug>`.
//
// RUXSAT shu yerda: hisobot o'z eski sahifasining ruxsati bilan ochiladi (lib/reportsCatalog.ts);
// yo'q bo'lsa — katalogga. Qatordagi amallar (to'lov qabul qilish, SMS, o'quvchi kartasi) ham
// ALOHIDA ruxsat bilan — o'sha amallarning API'lari bilan bir xil (lib/apiPermissions.generated.ts).

/** SMS yuborish API'si (/api/sms-messages) ochiq bo'lgan bo'limlar. */
const SMS_PATHS = ["/students-list", "/archive-students", "/first-lessons", "/orders-list", "/sales-messages"];

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = REPORT_BY_SLUG[slug];
  if (!report) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!canOpenReport(report, user.permissions)) redirect("/reports");
  const perms = {
    canPay: isPathAllowed("/finance-cash", user.permissions),
    canSms: SMS_PATHS.some((p) => isPathAllowed(p, user.permissions)),
    canOpenStudent: isPathAllowed("/students-list", user.permissions),
  };
  return <ReportView slug={slug as ReportSlug} author={shortPersonName(user.fullName || "")} perms={perms} />;
}
