"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { SALARY_ROWS, salaryOf } from "@/lib/employeeSalary";

// Kassa → Chiqim oynasidagi "Xodim ma'lumotlarini ko'rish" tugmasi ochadigan
// modal (referens skrinshoti). Sarlavhasi "Xodimlar", yonidagi ikonka —
// AKKORDEON: bosilganda jadval yig'iladi va faqat sarlavha satri qoladi.
// Modal ekranning o'rtasida, keng (referensda sahifaning katta qismini
// egallaydi).

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
  useEscapeClose(onClose);

  const s = salaryOf(employeeId);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-secondary/40 transition-colors"
          title={open ? "Yig'ish" : "Ochish"}
          aria-expanded={open}
        >
          <span className="text-[17px] font-semibold">Xodimlar</span>
          <ChevronDown className={`icon icon-sm text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="border-t border-border">
            {/* Xodim ismi referens modalida ko'rsatilmaydi, lekin qaysi xodim
                ekani aniq bo'lishi uchun mayda sarlavha qoldirildi. */}
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
        )}
      </div>
    </div>
  );
}
