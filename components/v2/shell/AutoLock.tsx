"use client";

import { useEffect, useRef } from "react";

// AVTOMATIK EKRAN QULFI (37-qism, Mening hisobim → Xavfsizlik → «Avtomatik qulflash»). Sozlama har xodimda
// (`users.prefs.autoLockMin`, /api/my-account?lite=1); 0 — o'chiq. Sichqoncha, klaviatura, bosish va aylantirish
// harakati hisoblanadi; boshqa oynada ishlayotgan bo'lsa ham (vaqt `localStorage` da umumiy) bitta oyna qulflamaydi.
// Belgilangan daqiqa harakatsiz o'tsa — /api/auth/lock va /lock sahifasi (ochiq oyna ma'lumoti brauzerda qoladi).

const KEY = "tizimli:last-activity";
const now = () => Date.now();

export default function AutoLock() {
  const minRef = useRef(0);

  useEffect(() => {
    let off = false;
    void fetch("/api/my-account?lite=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!off && j?.ok) minRef.current = Number(j.prefs?.autoLockMin) || 0;
      })
      .catch(() => {});
    const mark = () => {
      try {
        localStorage.setItem(KEY, String(now()));
      } catch {}
    };
    mark();
    let last = 0;
    const onAct = () => {
      if (now() - last > 5000) {
        last = now();
        mark();
      }
    };
    const evs = ["mousemove", "keydown", "pointerdown", "wheel", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, onAct, { passive: true }));
    const id = window.setInterval(() => {
      const min = minRef.current;
      if (!min) return;
      let at = now();
      try {
        at = Number(localStorage.getItem(KEY)) || now();
      } catch {}
      if (now() - at >= min * 60_000) {
        window.clearInterval(id);
        void fetch("/api/auth/lock", { method: "POST" })
          .catch(() => null)
          .then(() => window.location.assign("/lock"));
      }
    }, 20_000);
    return () => {
      off = true;
      window.clearInterval(id);
      evs.forEach((e) => window.removeEventListener(e, onAct));
    };
  }, []);
  return null;
}
