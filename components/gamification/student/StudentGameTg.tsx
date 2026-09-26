"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/shared/Language";
import { SpinnerBlock } from "@/components/ui/Spinner";
import StudentGame from "./StudentGame";

// Mini App qobig'i: Telegram SDK'ni yuklaydi, `initData` ni oladi va
// sahifani o'shani sarlavhada yuborib chizadi. O'quvchi id'si so'rovda
// YO'Q — server bog'lanishlardan topadi (lib/gamification/meAuth.ts).

const TG_SDK = "https://telegram.org/js/telegram-web-app.js";

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

export default function StudentGameTg() {
  const { t } = useT();
  const [initData, setInitData] = useState<string | null>(null);
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
      // Telegram mavzusiga moslashadi (kabinetdagi bilan bir xil).
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

  if (error) {
    return (
      <div className="mx-auto max-w-md p-5">
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold">{error}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{t("Botga qayting va «Mening sahifam» tugmasini bosing.")}</p>
        </div>
      </div>
    );
  }
  if (!initData) return <SpinnerBlock />;
  return <StudentGame source={{ kind: "tg", initData }} />;
}
