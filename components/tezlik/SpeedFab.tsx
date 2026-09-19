"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Link from "@/components/ui/Link";
import TapTest from "@/components/tezlik/TapTest";
import WhyFast from "@/components/tezlik/WhyFast";
import RobotFace from "@/components/tezlik/RobotFace";
import { useT } from "@/components/shared/Language";

// SUZUVCHI ROBOT — saytning har sahifasida turadigan, istalgan joyga
// sudrab qo'yiladigan tugma (referens: akademiya.edutizim.uz dagi robot).
// Bosilsa barmoq sinovi (TapTest.tsx) modalda ochiladi; sudralsa —
// faqat ko'chadi (5 px dan kam siljish = bosish). Joyi localStorage'da
// saqlanadi (qurilma bo'yicha), oyna kichraysa ekran ichiga qaytariladi.
// app/(app)/layout.tsx da mount qilinadi — ya'ni faqat kirgan
// foydalanuvchilarga ko'rinadi; ommaviy sahifalarda (login, /ariza) yo'q.

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

  if (!pos) return null;

  return (
    <>
      <button
        type="button"
        aria-label={t("Sayt tezligini o'lchash")}
        title={t("Sayt tezligi — bosing (sudrab ko'chirish mumkin)")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ position: "fixed", left: pos.x, top: pos.y, width: SIZE, height: SIZE, touchAction: "none", zIndex: 90 }}
        className={`group rounded-full bg-white dark:bg-slate-100 shadow-lg shadow-blue-500/30 ring-2 ring-blue-500/30 flex items-center justify-center select-none
          transition-transform ${dragging ? "scale-110 cursor-grabbing" : "cursor-grab hover:scale-105"}`}
      >
        {/* Nafas olayotgan halqa — e'tiborni tortadi, sudrashda o'chadi */}
        {!dragging && <span className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" style={{ animationDuration: "2.4s" }} />}
        <RobotFace className="w-9 h-9 relative" />
      </button>

      {open && (
        <Modal
          onClose={() => setOpen(false)}
          title={t("Tezlik sinovi")}
          subtitle={t("So'rov sizning qurilmangizdan serverga hozir yuboriladi — raqamlar jonli, taxmin emas.")}
          size="xl"
          bodyClassName="p-4 space-y-3"
          zIndex={1150}
          footer={
            <Link href="/tezlik" target="_blank" className="mr-auto inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
              <ExternalLink className="w-3.5 h-3.5" />{" "}{t("Alohida sahifada ochish")}
            </Link>
          }
        >
          <TapTest compact />
          <WhyFast compact />
        </Modal>
      )}
    </>
  );
}
