"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiAlert } from "@/lib/ai/protocol";

// ADMINGA OGOHLANTIRISHLAR — mijoz tomoni (12.10.2026, lib/ai/alerts.ts).
//
// Robot tugmasidagi belgi va AI panelidagi «Mohira xabarlari» shu hookdan.
// So'rov faqat admin uchun va faqat sayt OCHIQ turganda: sahifa ko'rinmasa
// yoki 15 daqiqa harakatsiz bo'lsa — yuborilmaydi (fon taymeri yo'q, serverga
// ortiqcha yuk tushmaydi; NotificationsProvider bilan bir xil naqsh).
// 401/403 — to'xtaydi (sessiya tugagan yoki admin emas).

const POLL_MS = 120_000;
const IDLE_MS = 15 * 60_000;
const STALE_MS = 30_000;

export interface AiAlertsApi {
  alerts: AiAlert[];
  unseen: number;
  markSeen: (keys: string[]) => void;
}

export function useAiAlerts(enabled: boolean): AiAlertsApi {
  const [alerts, setAlerts] = useState<AiAlert[]>([]);
  const busy = useRef(false);
  const stopped = useRef(false);
  const lastOk = useRef(0);
  const lastInput = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    lastInput.current = Date.now();
    const run = async () => {
      if (busy.current || stopped.current) return;
      busy.current = true;
      try {
        const res = await fetch("/api/ai/alerts", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          stopped.current = true;
          return;
        }
        const data = (await res.json()) as { ok?: boolean; alerts?: AiAlert[] };
        if (!cancelled && data?.ok && Array.isArray(data.alerts)) {
          setAlerts(data.alerts);
          lastOk.current = Date.now();
        }
      } catch {
        // Tarmoq xatosi — keyingi aylanishda qayta urinadi.
      } finally {
        busy.current = false;
      }
    };
    const onTick = () => {
      if (document.hidden || Date.now() - lastInput.current > IDLE_MS) return;
      void run();
    };
    const onInput = () => {
      lastInput.current = Date.now();
    };
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastOk.current > STALE_MS) void run();
    };
    // Sahifa yuklanishi bilan emas — biroz keyin (birinchi chizish og'irlashmasin).
    const first = window.setTimeout(() => void run(), 2_000);
    const timer = window.setInterval(onTick, POLL_MS);
    window.addEventListener("pointerdown", onInput, { passive: true });
    window.addEventListener("keydown", onInput);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("keydown", onInput);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  const markSeen = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    const set = new Set(keys);
    setAlerts((list) => list.map((a) => (set.has(a.key) ? { ...a, seen: true } : a)));
    void fetch("/api/ai/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen: keys }),
    }).catch(() => undefined);
  }, []);

  return { alerts, unseen: alerts.filter((a) => !a.seen).length, markSeen };
}
