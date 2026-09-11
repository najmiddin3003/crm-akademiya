// To'liq sahifali /orders-list/add formasining "yorliq chapda, boshqaruv
// o'ngda" qatorlari.
//
// O'lchamlar akademiya.edutizim.uz/orders/add dan bevosita o'lchab olingan
// (2026-08-23):
//   qator     — flex justify-between items-center, my-2 (8px), bal. 36px,
//               chegara YO'Q (ilgari bizda border-b bor edi)
//   yorliq    — 13px / 700, satr balandligi 19.5px; majburiy bo'lsa ":"
//               o'rniga qizil "*" qo'yiladi ("Kurs*" va "O'qituvchi:")
//   select    — o'ngda, qat'iy 250×32, radius 6px, chekkasiz, ichki
//               bo'shliq 0 11px, chevron 12px va o'ngdan 11px
//   input     — 250×33, radius 8px, ichki bo'shliq 4px, matn 14px
//
// MUHIM: select/input uchun padding Tailwind klassi bilan berilmaydi —
// globals.css ichidagi eski Tailwind v3 dump'ining
// "button,input,select,textarea{padding:0}" reset'i @layer'dan TASHQARIDA,
// shu bois v4 generatsiya qiladigan padding klasslarini (masalan
// px-[11px]) bosib ketadi. Aniq qiymatlar inline style bilan yoziladi.

/** Referens qator: chapda yorliq, o'ngda 250px boshqaruv (balandligi 36px). */
import Select from "@/components/ui/Select";

export const ROW_CLS = "flex justify-between items-center w-full my-2 min-h-9";
/**
 * Balandligi boshqaruvga qarab o'lchanadigan qator (32px). Referensda
 * "Referal bergan o'quvchi" qatori aynan shunday — qolgan uchtasidan 4px
 * pastroq; shu bois ajratgich va undan keyingi bo'lim joyida turadi.
 */
export const ROW_CLS_TIGHT = "flex justify-between items-center w-full my-2";
/** O'ngdagi boshqaruvning qat'iy kengligi. */
export const CONTROL_CLS = "relative w-[250px] shrink-0";

export function RowLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="text-[13px] font-bold leading-[19.5px]">
      {label}
      {required ? <span className="text-red-500">*</span> : ":"}
    </span>
  );
}

/** Qator ichidagi chevron — referensda 12px va o'ng chetdan 11px. */
export function RowChevron() {
  return (
    <svg
      className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
      style={{ right: 11 }}
    >
      <use href="#i-chevron-down" />
    </svg>
  );
}

export interface FormRowSelectProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  /**
   * Ro'yxat hali BACKENDDAN kelayotgan bo'lsa `true` — birinchi qatorda
   * "Yuklanmoqda…" turadi. Nativ `<select>` ichiga spinner chizib
   * bo'lmaydi, shuning uchun bu yerda faqat matn o'zgaradi.
   */
  loading?: boolean;
}

export function FormRowSelect({ label, required, value, onChange, options, placeholder = "...", loading }: FormRowSelectProps) {
  return (
    <div className={ROW_CLS}>
      <RowLabel label={label} required={required} />
      <div className={CONTROL_CLS}>
        <Select
          size="row"
          value={value}
          onChange={onChange}
          options={options.map((o) => ({ value: o, label: o }))}
          placeholder={placeholder}
          loading={loading}
          clearable
        />
      </div>
    </div>
  );
}

export interface FormRowTextProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FormRowText({ label, required, value, onChange, placeholder = "..." }: FormRowTextProps) {
  return (
    <div className={ROW_CLS}>
      <RowLabel label={label} required={required} />
      <div className={CONTROL_CLS}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ padding: "4px 12px" }}
          className="h-[33px] w-full rounded-lg border-0 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </div>
  );
}
