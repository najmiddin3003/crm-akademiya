"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/shared/Language";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { EmployeeProfileView } from "./EmployeeProfilePage";

// XODIMLAR BOTI — «👤 Profilim» Mini App qobig'i (28.09.2026).
//
// Telegram SDK'ni yuklaydi, `initData` ni oladi, /api/xodim/me dan "bu kim"
// ekanini so'raydi va saytdagi xodim profilini FAQAT KO'RISH rejimida
// chizadi (EmployeeProfileView `readOnly`). Sahifaning hamma so'rovi
// /api/xodim/data orqali ketadi — u javobni xodimning o'z ma'lumotigacha
// kesadi. Xodim id'si klientdan olinmaydi: server uni botdagi kirishdan
// topadi (lib/staffBot/webapp.ts).

const TG_SDK = "https://telegram.org/js/telegram-web-app.js";

/** Mini App'da tranzaksiya turlari katalogi yuklanmaydi — filtr yozuvlardagi nomlardan. */
const NO_TX_TYPES: string[] = [];

interface TelegramWebApp {
  initData: string;
  colorScheme?: string;
  ready: () => void;
  expand: () => void;
}

function tgApp(): TelegramWebApp | null {
  const w = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
  return w.Telegram?.WebApp ?? null;
}

export default function StaffProfileTg() {
  const { t } = useT();
  const [initData, setInitData] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const start = () => {
      const app = tgApp();
      if (!app || !app.initData) {
        setError(t("Bu sahifa Telegram boti orqali ochiladi"));
        return;
      }
      app.ready();
      app.expand();
      // Telegram mavzusiga moslashadi (o'quvchilar Mini App'idagi bilan bir xil).
      if (app.colorScheme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      setInitData(app.initData);
    };
    if (tgApp()) {
      const id = window.setTimeout(start, 0);
      return () => window.clearTimeout(id);
    }
    const s = document.createElement("script");
    s.src = TG_SDK;
    s.onload = start;
    s.onerror = () => setError(t("Telegram bilan aloqa o'rnatilmadi"));
    document.head.appendChild(s);
  }, [t]);

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

  if (error) {
    return (
      <div className="mx-auto max-w-md p-5">
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold">{error}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{t("Botga qayting va «👤 Profilim» tugmasini bosing.")}</p>
        </div>
      </div>
    );
  }
  if (!me) return <SpinnerBlock />;
  return <EmployeeProfileView id={me.id} txTypeNames={NO_TX_TYPES} readOnly getJson={getJson} />;
}
