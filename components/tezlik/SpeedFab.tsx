"use client";

import { useCallback, useEffect, useRef, useState, type AnimationEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Sparkles } from "lucide-react";
import AssistantPanel from "@/components/ai/AssistantPanel";
import MohiraAvatar from "@/components/ai/MohiraAvatar";
import { useT } from "@/components/shared/Language";
import { ASSISTANT_NAME } from "@/lib/ai/brand";

// SUZUVCHI ROBOT — saytning har sahifasida turadigan, istalgan joyga
// sudrab qo'yiladigan tugma (referens: akademiya.edutizim.uz dagi robot).
// Bosilsa AI yordamchi ochiladi (components/ai/AssistantPanel.tsx,
// 07.10.2026; 08.10 dan — to'liq ekran / suzuvchi oyna, ochiq turganda
// tugma yashirinadi); avvalgi barmoq sinovi (TapTest.tsx) o'sha panelning
// «Tezlik sinovi» tabida — yordamchi o'chiq bo'lsa panel shu tabdan
// ochiladi. Sudralsa — faqat ko'chadi (5 px dan kam siljish = bosish).
// Joyi localStorage'da saqlanadi (qurilma bo'yicha), oyna kichraysa ekran
// ichiga qaytariladi. app/(app)/layout.tsx da mount qilinadi — ya'ni faqat
// kirgan foydalanuvchilarga ko'rinadi; ommaviy sahifalarda (login, /ariza) yo'q.
//
// MOHIRAAI (09.10.2026, «Robot va interfeys — konsept 01», 02-kartochka):
// oq doira ichida robot boshi (components/ai/MohiraAvatar.tsx), ko'zlari
// sichqonchaga qaraydi, pastki burchakda onlayn nuqta. Standart joyi —
// o'ng-past burchak (saqlangan joyi bo'lsa — o'sha). Ustiga kelinsa yoki
// sudralsa robot xursand bo'ladi va yonida «Qanday yordam beray?» chiqadi;
// shu yozuv kunning birinchi kirishida o'zi ham bir necha soniya ko'rinadi.
// Oyna shu tugmadan «genie» bo'lib chiqadi va yopilganda unga qaytib
// kiradi — tugma oynani «qabul qilib» bir silkinadi (`.mh-fab-land`).

const STORAGE_KEY = "tizimli:speed-fab";
/** Bugun salomlashganmi (mahalliy sana) — kuniga bir marta. */
const HELLO_KEY = "tizimli:mohira-hello";
const HELLO_DELAY_MS = 1200;
const HELLO_MS = 4500;
const MARGIN = 8;
/** Standart joy — o'ng va pastki chetdan. */
const EDGE = 24;

interface Pos { x: number; y: number }

/** Konseptdagi 72 px; telefonda biroz kichikroq — sahifani to'smasin. */
function fabSize(): number {
  return window.innerWidth >= 640 ? 72 : 60;
}

function clamp(p: Pos, size: number): Pos {
  const maxX = Math.max(MARGIN, window.innerWidth - size - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - size - MARGIN);
  return { x: Math.min(Math.max(MARGIN, p.x), maxX), y: Math.min(Math.max(MARGIN, p.y), maxY) };
}

/** Standart joy — o'ng-past burchak (konsept: «Pastki burchakda»). */
function defaultPos(size: number): Pos {
  return clamp({ x: window.innerWidth - size - EDGE, y: window.innerHeight - size - EDGE }, size);
}

function loadPos(size: number): Pos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Pos>;
      if (typeof p.x === "number" && typeof p.y === "number") return clamp(p as Pos, size);
    }
  } catch {
    // localStorage yo'q/yopiq — standart joy
  }
  return defaultPos(size);
}

/** Bugun hali salomlashmaganmi — ha bo'lsa, belgilab qo'yadi. */
function helloDue(): boolean {
  try {
    const d = new Date();
    const today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (localStorage.getItem(HELLO_KEY) === today) return false;
    localStorage.setItem(HELLO_KEY, today);
    return true;
  } catch {
    return false; // eslab qololmasak — har sahifada chiqib bezor qilmasin
  }
}

export default function SpeedFab() {
  const { t } = useT();
  const [pos, setPos] = useState<Pos | null>(null);
  const [size, setSize] = useState(72);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Sichqoncha ustida — robot xursand, yonida yozuv. */
  const [hover, setHover] = useState(false);
  /** Kunning birinchi salomi. */
  const [hello, setHello] = useState(false);
  /** Oyna tugmaga qaytib kirdi — tugma bir silkinadi. */
  const [landing, setLanding] = useState(false);
  const drag = useRef<{ startX: number; startY: number; origin: Pos; moved: boolean } | null>(null);

  // Joy va o'lcham faqat brauzerda ma'lum — server render'ida tugma
  // chizilmaydi (gidratatsiya nomuvofiqligi bo'lmasin).
  useEffect(() => {
    const id = setTimeout(() => {
      const s = fabSize();
      setSize(s);
      setPos(loadPos(s));
    }, 0);
    const onResize = () => {
      const s = fabSize();
      setSize(s);
      setPos((p) => (p ? clamp(p, s) : p));
    };
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(id); window.removeEventListener("resize", onResize); };
  }, []);

  // «Qanday yordam beray?» — kunning birinchi kirishida bir necha soniya.
  // Belgi taymer ichida qo'yiladi: dev'dagi ikki marta mount (StrictMode)
  // salomni yeb qo'ymasin.
  useEffect(() => {
    const show = window.setTimeout(() => {
      if (helloDue()) setHello(true);
    }, HELLO_DELAY_MS);
    const hide = window.setTimeout(() => setHello(false), HELLO_DELAY_MS + HELLO_MS);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, origin: pos, moved: false };
  }, [pos]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) { d.moved = true; setDragging(true); setHello(false); }
    setPos(clamp({ x: d.origin.x + dx, y: d.origin.y + dy }, size));
  }, [size]);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.moved) {
      setDragging(false);
      setPos((p) => {
        if (p) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* yo'q bo'lsa — mayli */ } }
        return p;
      });
    } else {
      // Tugma yashirinadi — `pointerleave` kelmaydi, holatni o'zimiz tozalaymiz.
      setHover(false);
      setHello(false);
      setOpen(true);
    }
  }, []);

  const onClose = useCallback(() => {
    setOpen(false);
    setLanding(true);
  }, []);

  // Faqat tugmaning o'z «qo'nish» animatsiyasi — ichidagi robot animatsiyalari ham shu yerga ko'tariladi.
  const onAnimationEnd = (e: AnimationEvent<HTMLButtonElement>) => {
    if (e.target === e.currentTarget && e.animationName === "mh-fab-land") setLanding(false);
  };

  if (!pos) return null;

  // Yozuv ekranning ichki tomoniga chiqadi: tugma o'ngda bo'lsa — chapida.
  const side = pos.x + size / 2 > window.innerWidth / 2 ? "left" : "right";

  // Panel ochiq bo'lsa tugma yashirinadi — kichraygan panel (suzuvchi oyna)
  // o'zi ekranda turadi, ikkalasi ustma-ust tushmasin.
  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label={t("{name} — AI yordamchi. Bosing yoki sudrab ko'chiring", { name: ASSISTANT_NAME })}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }}
          onPointerLeave={() => setHover(false)}
          onAnimationEnd={onAnimationEnd}
          style={{ position: "fixed", left: pos.x, top: pos.y, width: size, height: size, touchAction: "none", zIndex: 90 }}
          className={`mh-fab flex select-none items-center justify-center rounded-full transition-transform
            ${dragging ? "scale-110 cursor-grabbing" : "cursor-grab hover:scale-105"} ${landing ? "mh-fab-land" : ""}`}
        >
          <MohiraAvatar mood={dragging || hover || hello ? "happy" : "idle"} gaze />
          <span aria-hidden className="mh-fab-dot" />
          {!dragging && (
            <span aria-hidden className="mh-say" data-side={side} data-show={hello ? "" : undefined}>
              {t("Qanday yordam beray?")}
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            </span>
          )}
        </button>
      )}

      {open && <AssistantPanel origin={{ x: pos.x, y: pos.y, w: size, h: size }} onClose={onClose} />}
    </>
  );
}
