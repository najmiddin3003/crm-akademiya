import type { Metadata } from "next";
import CvApplyPage from "@/components/management/CvApplyPage";

// Ommaviy ish arizasi — nomzod CRM'ga kirmasdan to'ldiradi. Havolani
// Boshqaruv → Ishga qabul (CV) sahifasidagi "Ariza havolasini ulashish"
// tugmasi beradi. Sahifa `(app)` guruhidan tashqarida — sidebar/navbar yo'q.

export const metadata: Metadata = {
  title: "Ishga qabul anketasi — Akademiya o'quv markazi",
};

export default function Page() {
  return <CvApplyPage />;
}
