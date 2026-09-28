"use client";

import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";
import { GROUP_DAYS } from "@/constants/groups";
import { groupWeekdays } from "@/lib/attendance";
import { GROUP_WEEK, groupDayValue } from "@/lib/groupDays";

// Guruh formasidagi «Dars kunlari» (28.09.2026, foydalanuvchi: "hohlagan kunni
// tanlaydigan qilish kerak, dushanbadan yakshanbagacha ro'yxat chiqib tursin,
// GROUP_DAYS ham joyida tursin").
//
// Tepada tayyor variantlar (GROUP_DAYS), ostida doim ko'rinadigan 7 ta kun
// tugmasi — ikkalasi bitta qiymatga bog'langan: tayyor variant tanlansa uning
// kunlari tugmalarda yonadi; tugmalar bosilsa va to'plam biror tayyor
// variantga teng chiqsa o'sha NOM saqlanadi (Du+Ch+Ju → «Toq kunlar»), aks
// holda qisqartmalar vergul bilan ("Du,Ch,Sh"). Bu yozuvni davomat, qarzdorlik,
// xona bandligi va dars jadvali tushunadi (lib/attendance.ts `groupWeekdays`).

export default function GroupDaysField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useT();
  const selected = groupWeekdays(value);
  // Tayyor ro'yxatda yo'q qiymat (istalgan kunlar) ham tanlovda ko'rinsin.
  const options = [...GROUP_DAYS, ...(value && !GROUP_DAYS.includes(value) ? [value] : [])].map((d) => ({ value: d, label: d }));

  function toggle(wd: number) {
    onChange(groupDayValue(selected.includes(wd) ? selected.filter((x) => x !== wd) : [...selected, wd]));
  }

  return (
    <div>
      <Select label={t("Dars kunlari")} required value={value} onChange={onChange} options={options} placeholder={t("Tanlang")} />
      <div className="mt-2 flex gap-1" role="group" aria-label={t("Istalgan kunlar")}>
        {GROUP_WEEK.map((d) => {
          const on = selected.includes(d.wd);
          return (
            <button
              key={d.wd}
              type="button"
              aria-pressed={on}
              title={t(d.long)}
              onClick={() => toggle(d.wd)}
              className={`h-8 min-w-0 flex-1 rounded-md border text-[12px] font-semibold transition-colors ${
                on ? "border-primary bg-primary text-white" : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t(d.abbr)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
