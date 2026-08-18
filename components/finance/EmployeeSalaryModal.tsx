"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SALARY_ROWS, salaryOf } from "@/lib/employeeSalary";

// Kassa → Chiqim oynasidagi "Xodim ma'lumotlarini ko'rish" tugmasi ochadigan
// modal (referens skrinshoti). Sarlavhasi "Xodimlar", yonidagi ikonka —
// AKKORDEON: bosilganda jadval silliq yig'iladi va faqat sarlavha qoladi.
//
// ── Animatsiya haqida ────────────────────────────────────────────────────
// 1. Tailwind klasslari ISHLATILMAYDI. Bu loyihada CSS kompilyatsiya qilingan
//    blobdan keladi va yangi utilitalar generatsiya bo'lmaydi — brauzerda
//    tekshirilgan: `rotate-180` ham, `duration-300` ham mavjud emas.
// 2. `grid-template-rows: 1fr → 0fr` usuli HAM ishlamadi: o'lchov ko'rsatdi
//    (150 ms da hali to'liq balandlik, so'ng birdan 0) — `fr` birligi bu
//    brauzerda interpolatsiya qilinmaydi.
// Shu sabab klassik usul: balandlik `scrollHeight` dan o'lchanadi va px da
// animatsiya qilinadi. Balandlik JSX `style` ida YO'Q — u faqat imperativ
// qo'yiladi, shuning uchun React qayta render bo'lganda uni o'chirmaydi.
// Ochilib bo'lgach `auto` ga o'tkaziladi, aks holda kontent o'zgarsa kesilib
// qolardi.

function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}

export default function EmployeeSalaryModal({
  employeeId,
  employeeName,
  onClose,
}: {
  employeeId: number;
  employeeName: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();
  useEscapeClose(onClose);

  const s = salaryOf(employeeId);
  const duration = reduceMotion ? "0s" : ".3s";
  const ease = `${duration} cubic-bezier(.4,0,.2,1)`;

  /** Ochilib bo'lgach balandlikni `auto` ga qaytaradi — kontent o'zgarsa
   *  yoki oyna kengligi o'zgarib qator ikkiga bo'linsa kesilmasin. */
  function releaseHeight() {
    const el = bodyRef.current;
    if (el) el.style.height = "auto";
  }

  function toggle() {
    const el = bodyRef.current;
    const collapsing = open;
    setOpen((o) => !o);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (!el) return;

    if (collapsing) {
      // `auto` dan animatsiya bo'lmaydi — avval aniq balandlik qo'yamiz,
      // uni reflow bilan qayd ettiramiz, so'ng nolga tushiramiz.
      // `requestAnimationFrame` ATAYIN ishlatilmadi: tab fonda bo'lsa u
      // umuman chaqirilmaydi va akkordeon ochiq holda qotib qolardi
      // (brauzerda shu holat kuzatildi).
      el.style.height = `${el.scrollHeight}px`;
      void el.offsetHeight;
      el.style.height = "0px";
    } else {
      // Ochish: joriy balandlik allaqachon 0px, shuning uchun reflow shart emas.
      el.style.height = `${el.scrollHeight}px`;
      // `transitionend` ga TAYANMAYMIZ: oyna fonda bo'lsa u yetkazilmasligi
      // brauzerda kuzatildi. Taymer zaxira — ikkalasidan qaysi biri birinchi
      // ishlasa, o'sha `auto` qilib qo'yadi (ikki marta bajarilishi zararsiz).
      autoTimer.current = setTimeout(releaseHeight, reduceMotion ? 0 : 350);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={toggle}
          className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-secondary/40 transition-colors"
          title={open ? "Yig'ish" : "Ochish"}
          aria-expanded={open}
        >
          <span className="text-[17px] font-semibold">Xodimlar</span>
          <ChevronDown
            className="icon icon-sm text-muted-foreground"
            style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: `transform ${ease}` }}
          />
        </button>

        <div
          ref={bodyRef}
          style={{ overflow: "hidden", transition: `height ${ease}` }}
          onTransitionEnd={(e) => {
            if (e.propertyName === "height" && open) releaseHeight();
          }}
        >
          <div className="border-t border-border">
            {/* Xodim ismi referens modalida ko'rsatilmaydi, lekin qaysi
                xodim ekani aniq bo'lishi uchun mayda sarlavha qoldirildi. */}
            <div className="px-6 pt-3 text-[12px] text-muted-foreground">{employeeName}</div>
            <ul className="px-6 pb-2 divide-y divide-border">
              {SALARY_ROWS.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-4 py-3.5">
                  <span className="text-[14px]">{r.label}</span>
                  <span className="text-[14px] font-medium tabular-nums">{fmtUZS(s[r.key])}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
