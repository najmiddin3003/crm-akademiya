"use client";

import { useCallback, useEffect, useRef, useState, type AnimationEvent } from "react";
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
// MOHIRAAI (08.10.2026): tugmada milliy libosli, harakatlanuvchi robot
// (components/ai/MohiraAvatar.tsx), atlas ranglaridagi halqa; ustiga
// kelinsa Mac'dagi Dock kabi nomi chiqadi. Oyna shu tugmadan «genie» bo'lib
// chiqadi va yopilganda unga qaytib kiradi — tugma oynani «qabul qilib»
// bir silkinadi (`.mh-fab-land`).

const STORAGE_KEY = "tizimli:speed-fab";
const SIZE = 56;
const MARGIN = 8;

interface Pos { x: number; y: number }

function clamp(p: Pos): Pos {
  const maxX = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN);
  return { x: Math.min(Math.max(MARGIN, p.x), maxX), y: Math.min(Math.max(MARGIN, p.y), maxY) };
}

/** Standart joy — chap-past burchak, sidebar'dagi "Texnik yordam" ustida. */
function defaultPos(): Pos {
  return clamp({ x: 16, y: window.innerHeight - SIZE - 88 });
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Pos>;
      if (typeof p.x === "number" && typeof p.y === "number") return clamp(p as Pos);
    }
  } catch {
    // localStorage yo'q/yopiq — standart joy
  }
  return defaultPos();
}

export default function SpeedFab() {
  const { t } = useT();
  const [pos, setPos] = useState<Pos | null>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Oyna tugmaga qaytib kirdi — tugma bir silkinadi. */
  const [landing, setLanding] = useState(false);
  const drag = useRef<{ startX: number; startY: number; origin: Pos; moved: boolean } | null>(null);

  // Joy faqat brauzerda ma'lum — server render'ida tugma chizilmaydi
  // (gidratatsiya nomuvofiqligi bo'lmasin).
  useEffect(() => {
    const id = setTimeout(() => setPos(loadPos()), 0);
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(id); window.removeEventListener("resize", onResize); };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, origin: pos, moved: false };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) { d.moved = true; setDragging(true); }
    setPos(clamp({ x: d.origin.x + dx, y: d.origin.y + dy }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
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
          onAnimationEnd={onAnimationEnd}
          style={{ position: "fixed", left: pos.x, top: pos.y, width: SIZE, height: SIZE, touchAction: "none", zIndex: 90 }}
          className={`mh-fab group flex select-none items-center justify-center rounded-full transition-transform
            ${dragging ? "scale-110 cursor-grabbing" : "cursor-grab hover:scale-105"} ${landing ? "mh-fab-land" : ""}`}
        >
          {/* Nafas olayotgan halqa — e'tiborni tortadi, sudrashda o'chadi */}
          {!dragging && <span className="mh-fab-halo absolute inset-0 rounded-full animate-ping" style={{ animationDuration: "2.4s" }} />}
          <MohiraAvatar className="relative h-11 w-11" />
          {/* Mac'dagi Dock kabi — ustiga kelinsa nomi chiqadi (tepada joy bo'lmasa — pastda). */}
          {!dragging && (
            <span aria-hidden className={`mh-fab-label ${pos.y < 44 ? "mh-fab-label-below" : ""}`}>
              {ASSISTANT_NAME}
            </span>
          )}
        </button>
      )}

      {open && <AssistantPanel origin={{ x: pos.x, y: pos.y, w: SIZE, h: SIZE }} onClose={onClose} />}
    </>
  );
}
