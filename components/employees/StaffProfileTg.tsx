"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/shared/Language";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { EmployeeProfileView } from "./EmployeeProfilePage";
import { LessonSheetView, LessonsCard } from "./StaffLessonsTg";
import { useTelegramWebApp } from "./useTelegramWebApp";

// XODIMLAR BOTI — «👤 Profilim» Mini App qobig'i (28.09.2026).
//
// Telegram SDK'ni yuklaydi (useTelegramWebApp), /api/xodim/me dan "bu kim"
// ekanini so'raydi va saytdagi xodim profilini FAQAT KO'RISH rejimida
// chizadi (EmployeeProfileView `readOnly`). Sahifaning hamma so'rovi
// /api/xodim/data orqali ketadi — u javobni xodimning o'z ma'lumotigacha
// kesadi. Xodim id'si klientdan olinmaydi: server uni botdagi kirishdan
// topadi (lib/staffBot/webapp.ts).
//
// O'QITUVCHI DAVOMATI (05.11.2026): profil tepasida bugungi darslar, bosilsa
// o'sha guruhning davomati (StaffLessonsTg.tsx). `guruh` — «Davomatni boshlang»
// xabaridagi tugma shu guruhni to'g'ridan-to'g'ri ochib keladi.

/** Mini App'da tranzaksiya turlari katalogi yuklanmaydi — filtr yozuvlardagi nomlardan. */
const NO_TX_TYPES: string[] = [];

export default function StaffProfileTg({ guruh = null }: { guruh?: number | null }) {
  const { t } = useT();
  const { app, initData, error: sdkError } = useTelegramWebApp();
  const [me, setMe] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState("");
  const [sheetId, setSheetId] = useState<number | null>(guruh);

  useEffect(() => {
    if (!initData) return;
    let cancelled = false;
    fetch("/api/xodim/me", { headers: { "x-telegram-init-data": initData } })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) setMe(d.employee as { id: number; name: string });
        else setError(t(d?.error || "Profil yuklanmadi"));
      })
      .catch(() => {
        if (!cancelled) setError(t("Tarmoq xatosi — qayta urinib ko'ring"));
      });
    return () => { cancelled = true; };
  }, [initData, t]);

  // BARQAROR bo'lishi shart — profil sahifasining effektlari unga bog'liq.
  const getJson = useCallback(
    (url: string) =>
      fetch(`/api/xodim/data?u=${encodeURIComponent(url)}`, {
        headers: { "x-telegram-init-data": initData ?? "" },
      })
        .then((r) => r.json())
        .catch(() => null),
    [initData],
  );

  const shownError = sdkError || error;
  if (shownError) {
    return (
      <div className="mx-auto max-w-md p-5">
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold">{shownError}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{t("Botga qayting va «👤 Profilim» tugmasini bosing.")}</p>
        </div>
      </div>
    );
  }
  if (!me) return <SpinnerBlock />;
  if (sheetId !== null) {
    return <LessonSheetView groupId={sheetId} initData={initData ?? ""} app={app} onBack={() => setSheetId(null)} />;
  }
  return (
    <>
      <LessonsCard initData={initData ?? ""} onOpen={setSheetId} />
      <EmployeeProfileView id={me.id} txTypeNames={NO_TX_TYPES} readOnly getJson={getJson} />
    </>
  );
}
