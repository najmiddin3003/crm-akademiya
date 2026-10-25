"use client";

import "@fontsource-variable/onest/wght.css";
import { REPORT_BY_SLUG, type ReportSlug } from "@/lib/reportsCatalog";
import { DavomatGuruhlarReport, DavomatOqituvchilarReport } from "./DavomatReports";
import FaolOquvchilarReport from "./FaolOquvchilarReport";
import KelganKetganReport from "./KelganKetganReport";
import { KirimChiqimReport, TolovTurlariReport } from "./MoliyaReports";
import QarzdorlarReport, { type RowPerms } from "./QarzdorlarReport";
import { BonusJarimaReport, OylikAvansReport } from "./XodimReports";

// HISOBOTLAR (15-qism) — `/reports/<slug>` sahifasi: slug bo'yicha hisobot komponenti.
// Ruxsat serverda tekshirilgan (app/(app)/reports/[slug]/page.tsx).

export default function ReportView({ slug, author, perms }: { slug: ReportSlug; author: string; perms: RowPerms }) {
  const report = REPORT_BY_SLUG[slug];
  if (!report) return null;
  switch (slug) {
    case "kirim-chiqim":
      return <KirimChiqimReport report={report} author={author} />;
    case "qarzdorlar":
      return <QarzdorlarReport report={report} author={author} perms={perms} />;
    case "tolov-turlari":
      return <TolovTurlariReport report={report} author={author} />;
    case "kelgan-ketgan":
      return <KelganKetganReport report={report} author={author} />;
    case "faol-oquvchilar":
      return <FaolOquvchilarReport report={report} author={author} />;
    case "davomat-guruhlar":
      return <DavomatGuruhlarReport report={report} author={author} />;
    case "davomat-oqituvchilar":
      return <DavomatOqituvchilarReport report={report} author={author} />;
    case "oylik-avans":
      return <OylikAvansReport report={report} author={author} />;
    case "bonus-jarima":
      return <BonusJarimaReport report={report} author={author} />;
    default:
      return null;
  }
}
