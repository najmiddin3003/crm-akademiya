"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  payrollDue,
  payrollEarned,
  payrollFoizPart,
  payrollHasFoiz,
  payrollHasOklad,
  payrollOkladDays,
  payrollOkladPart,
  payrollStartsInPeriod,
  type EmployeePayroll,
  type PayrollPeriod,
} from "@/lib/salary";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Kassa → Chiqim oynasidagi "Xodim ma'lumotlarini ko'rish" tugmasi ochadigan
// modal (referens skrinshoti). Sarlavhasi "Xodimlar", yonidagi ikonka —
// AKKORDEON: bosilganda jadval silliq yig'iladi va faqat sarlavha qoladi.
//
// Raqamlar BAZADAN: /api/salary-runs/employees-payroll qatoridan (Xodimlar
// ro'yxati va Oylik chiqarish sahifasi o'qiydigan bitta manba). Ilgari ular
// xodim `id` sidan hosil qilingan soxta sonlar edi — ya'ni modal chiroyli
// ko'rinardi-yu, hech qanday haqiqiy oylikni ko'rsatmasdi.
//
// Qatorlarning referensdagi arifmetikasi saqlangan:
//   Davomatdan foizi = Davomat × foiz
//   Oylik  = Davomatdan foizi + Bonus + Akladi − Jarima
//   Balans = Oylik − Avans − Olingan oylik   (ya'ni QOLGAN oylik)
// "Olingan oylik" qatori referensda yo'q, lekin bizda alohida hisoblanadi —
// usiz Balans qayerdan kelganini tushunib bo'lmasdi.
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
  return sign + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}

interface Row {
  label: string;
  value: number;
  /** Izoh — qiymat qayerdan kelgani (masalan foiz). */
  hint?: string;
  strong?: boolean;
}

function rowsOf(e: EmployeePayroll, p: PayrollPeriod): Row[] {
  const earned = payrollEarned(e, p);
  const due = payrollDue(e, p);
  const hasFoiz = payrollHasFoiz(e);
  // Asos qatorlari: foiz qismi va/yoki oklad qismi. "Oklad + foiz" xodimda
  // IKKALASI ham turadi — yig'indisi `payrollBase` (lib/salary.ts).
  const baseRows: Row[] = [];
  if (hasFoiz) baseRows.push({ label: "Davomatdan foizi", value: payrollFoizPart(e), hint: `${e.percent}%` });
  if (payrollHasOklad(e)) {
    baseRows.push({
      label: "Oklad (shu kungacha)",
      value: payrollOkladPart(e, p),
      // Oy o'rtasida ishga kirgan bo'lsa — nechta kun hisoblangani.
      hint: payrollStartsInPeriod(e, p) ? `${payrollOkladDays(e, p)}/${p.daysIn} kun` : undefined,
    });
  }
  return [
    // Foizli o'qituvchida asos — shu oyda u orqali tushgan pul (SOF:
    // o'quvchilarga qaytarilgani ayrilgan, izohda ko'rinadi); faqat oklad
    // oladigan xodimda tushum oyligiga ta'sir qilmaydi, shuning uchun 0.
    {
      label: "Davomat",
      value: hasFoiz ? e.collected : 0,
      hint: hasFoiz && (e.refunded ?? 0) > 0 ? `qaytarim −${fmtUZS(e.refunded)}` : undefined,
    },
    ...baseRows,
    { label: "Bonus", value: e.bonus },
    { label: "Jarima", value: e.jarima },
    { label: "Akladi", value: e.carryOver, hint: "o'tgan oydan" },
    { label: "Oylik", value: earned, strong: true },
    { label: "Avans", value: e.paidAvans },
    { label: "Olingan oylik", value: e.paidOylik },
    { label: "Balans", value: due, hint: "qolgan", strong: true },
  ];
}

export default function EmployeeSalaryModal({
  payroll,
  period,
  employeeName,
  onClose,
}: {
  /** Xodimning oylik qatori; sozlanmagan bo'lsa `undefined`. */
  payroll: EmployeePayroll | undefined;
  period: PayrollPeriod;
  employeeName: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [open, setOpen] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();

  const duration = reduceMotion ? "0s" : ".3s";
  const ease = `${duration} cubic-bezier(.4,0,.2,1)`;
  const rows = payroll?.configured ? rowsOf(payroll, period) : null;

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
    <Modal onClose={onClose} controller={modal} bare size="3xl" zIndex={300}>
        <button
          type="button"
          onClick={toggle}
          className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-secondary/40 transition-colors"
          title={open ? t("Yig'ish") : t("Ochish")}
          aria-expanded={open}
        >
          <span className="text-[17px] font-semibold">{t("Xodimlar")}</span>
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
            <div className="px-6 pt-3 text-[12px] text-muted-foreground">
              {employeeName}
              {/* `month` 0-11 (lib/salary.ts) — ilgari +1 qilinmagani uchun
                  sentabr "8.2026" bo'lib chiqardi. */}
              {payroll?.configured && (
                <span> · {String(period.month + 1).padStart(2, "0")}.{period.year}</span>
              )}
            </div>

            {rows ? (
              <ul className="px-6 pb-2 divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-4 py-3.5">
                    <span className="text-[14px]">
                      {t(r.label)}
                      {r.hint && <span className="text-[12px] text-muted-foreground"> ({r.hint})</span>}
                    </span>
                    <span className={`text-[14px] tabular-nums ${r.strong ? "font-semibold" : "font-medium"}`}>
                      {fmtUZS(r.value)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="text-[14px] font-medium">{t("Oylik sozlanmagan")}</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {t("Xodim kartasida ish haqi kiritilmagan — hisoblanadigan raqam yo'q.")}
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>
  );
}
