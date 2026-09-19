"use client";
import { useT } from "@/components/shared/Language";

// Ported from the real site's Blok xolatini tekshirish tab — a single status
// banner (differs from the reference crm-akademiya/src/app.js
// renderStudentEditBlok() placeholder, which had a heading + Bloklash/
// Tarixini ko'rish buttons instead).

export default function BlokTabContent() {
  const { t } = useT();
  return (
    <div className="rounded-xl bg-emerald-50 text-emerald-700 p-4 text-center text-sm font-medium">
      {t("Yordamchi o'qituvchiga yozilish uchun bloklanmagan")}
    </div>
  );
}
