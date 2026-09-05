"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ODDIY INPUT + TAVSIYALAR. `<select>` EMAS — ATAYLAB.
//
// Farqi muhim: `StudentSearchSelect` YOPIQ ro'yxat, qiymat faqat
// tugmadan chiqadi. Izoh esa erkin matn — kassir istalgan narsani yozishi
// mumkin va yozayotganini hech narsa to'smasligi kerak. Bu yerda ro'yxat
// faqat YORDAM beradi: bosilsa maydonga qo'yiladi, e'tibor berilmasa
// oddiy input bo'lib qolaveradi.
//
// Nega kerak: bir xil izoh kunda o'nlab marta qo'lda yoziladi va bir harf
// farq bilan yozilgani keyin jadval filtrida alohida qiymat bo'lib
// chiqadi ("Sentabr uchun" va "sentabr uchun").

export default function SuggestInput({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  maxLength,
  emptyHint,
  limit = 50,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Tavsiyalar. Tartib SAQLANADI — chaqiruvchi eng keraklisini oldinga qo'yadi. */
  options: string[];
  placeholder?: string;
  className?: string;
  maxLength?: number;
  /** Tavsiya umuman yo'q bo'lgandagi matn. Berilmasa ro'yxat ochilmaydi. */
  emptyHint?: string;
  /** Bir vaqtda chiziladigan maksimal qator. */
  limit?: number;
}) {
  const [open, setOpen] = useState(false);
  /**
   * Ro'yxat maydonning USTIDA ochiladimi.
   *
   * O'LCHANDI: kassa oynasida "Izoh" — eng oxirgi maydon va uning tagida
   * atigi ~170px joy bor, ya'ni pastga ochilgan ro'yxat oynaning
   * pastki chekkasi ostiga kirib ketardi (skrinshotda ikkita qatordan
   * boshqasi ko'rinmasdi). Shuning uchun joy yetmasa ustiga ochiladi.
   */
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  /** Ro'yxatning eng katta balandligi (max-h-56 = 224px) + chegara. */
  const DROPDOWN_H = 232;

  function openList() {
    const r = ref.current?.getBoundingClientRect();
    // Oyna pastidan tashqari yana ~80px zaxira: drawer'ning "Saqlash"
    // qatori shuncha joyni egallaydi va ro'yxat uning ostida qolardi.
    if (r) setDropUp(window.innerHeight - r.bottom - 80 < DROPDOWN_H && r.top > DROPDOWN_H);
    setOpen(true);
  }

  const q = value.trim().toLowerCase();
  // Ro'yxat YOPIQ bo'lsa filtrlash umuman bajarilmaydi — ota oynadagi har
  // bir o'zgarish (summa yozish, sana tanlash) 200 ta matnni qaytadan
  // skanerlamasin. Naqsh StudentSearchSelect dan.
  const filtered = useMemo(() => {
    if (!open) return [];
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [open, options, q]);
  const shown = filtered.length > limit ? filtered.slice(0, limit) : filtered;
  const hidden = filtered.length - shown.length;

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); openList(); }}
        // Maydonga kirilganda ro'yxat DARHOL ochiladi: tavsiyalar borligini
        // bilish uchun avval biror harf yozishga majburlash — yashirin
        // xususiyat degani.
        onFocus={openList}
        onClick={openList}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !open) return;
          // Escape faqat RO'YXATNI yopadi. `stopPropagation` shart:
          // kassa oynasi Escape ni `window` da tinglaydi
          // (hooks/useEscapeClose) va usiz butun oyna yopilib, kassir
          // to'ldirgan maydonlarini yo'qotardi.
          e.stopPropagation();
          e.preventDefault();
          setOpen(false);
        }}
        type="text"
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {open && (shown.length > 0 || emptyHint) && (
        <div
          className={`absolute z-30 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden ${
            dropUp ? "bottom-full mb-1" : "mt-1"
          }`}
        >
          <div className="max-h-56 overflow-y-auto">
            {shown.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">{emptyHint}</div>
            ) : (
              shown.map((o, i) => (
                <button
                  key={`${o}-${i}`}
                  type="button"
                  // `onMouseDown` — `onClick` EMAS. Bosilganda input avval
                  // fokusni yo'qotadi va tashqi bosish qorovuli ro'yxatni
                  // yopib ulgurardi, ya'ni bosish ba'zan "tushmasdi".
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(o);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-secondary ${
                    value === o ? "bg-primary/10 font-medium text-primary" : ""
                  }`}
                >
                  <span className="block truncate">{o}</span>
                </button>
              ))
            )}
            {hidden > 0 && (
              <div className="border-t border-border px-3 py-2 text-[11.5px] text-muted-foreground">
                Yana {hidden} ta — yozib qidiring
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
