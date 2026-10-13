"use client";

import { useRef, useState, type ReactNode } from "react";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { isFutureIsoDay } from "@/lib/uzTime";

// ISHDAN KETISH SANASI KELAJAKDA — tasdiq (13.10.2026, foydalanuvchi: «agar
// kelajak vaqti tanlansa confirm modal chiqsin»).
//
// Sana TANLANISHI (yoki to'liq yozilishi) bilan so'raladi, saqlashda emas:
// maydon yangi sanani darhol ko'rsatadi; «Ha» — qoladi, «Yo'q» (yoki Esc /
// fon / X) — tanlovdan OLDINGI qiymatga qaytadi. Kelajak sana xato emas:
// xodim shu kungacha ishlaydi, oklad shu kungacha hisoblanadi
// (lib/salary.ts → payrollOkladDays), Oylik sahifasi uni «ishdan ketadigan
// sana» deb ko'rsatadi.
//
// DateField `onChange` ni faqat TO'LIQ sana (yoki "") bilan chaqiradi — chala
// yozuvda so'rov chiqmaydi. Bazadan kelgan (avval tasdiqlangan) sana oyna
// ochilganda qayta so'ralmaydi — faqat o'zgartirilganda.
//
// Ishlatilishi (Ish haqi oynasi va Xodim qo'shish/tahrirlash oynasi):
//   const endConfirm = useFutureEndDateConfirm(endDate, setEndDate);
//   <DateField value={endDate} onChange={endConfirm.onChange} … />
//   {endConfirm.dialog}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function useFutureEndDateConfirm(
  value: string,
  setValue: (v: string) => void,
): { onChange: (next: string) => void; dialog: ReactNode } {
  const { t } = useT();
  const [ask, setAsk] = useState<{ date: string; prev: string } | null>(null);
  // «Ha» bosildimi — yopilishning qolgan hamma yo'li sanani qaytaradi.
  const yesRef = useRef(false);

  const onChange = (next: string) => {
    setValue(next);
    if (next && next !== value && isFutureIsoDay(next)) {
      yesRef.current = false;
      setAsk({ date: next, prev: value });
    }
  };

  const dialog = ask ? (
    <Modal
      onClose={() => {
        if (!yesRef.current) setValue(ask.prev);
        setAsk(null);
      }}
      bare
      size="sm"
      zIndex={130}
      panelClassName="p-6"
    >
      {(modal) => (
        <>
          <p className="text-center text-[15px] font-semibold">{t("Ishdan ketish sanasi kelajakda")}</p>
          <p className="mt-2 text-center text-[13px] text-muted-foreground">
            {t("{date} hali kelmagan. Xodim shu kungacha ishlaydi va oklad shu kungacha hisoblanadi. Oylik sahifasida «ishdan ketadigan sana» deb ko'rinadi. Tasdiqlaysizmi?", { date: fmtDay(ask.date) })}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={modal.close}
              className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
            >
              {t("Yo'q")}
            </button>
            <button
              type="button"
              onClick={() => {
                yesRef.current = true;
                modal.close();
              }}
              className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
            >
              {t("Ha")}
            </button>
          </div>
        </>
      )}
    </Modal>
  ) : null;

  return { onChange, dialog };
}
