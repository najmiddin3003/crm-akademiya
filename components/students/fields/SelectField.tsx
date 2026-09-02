import { LOADING_TEXT } from "@/lib/selectPlaceholder";

// O'quvchi profilidagi tanlov maydoni.
//
// `options` + `onChange` berilsa haqiqiy tanlov bo'ladi; berilmasa eski
// ko'rinish (faqat bitta qiymatni ko'rsatuvchi) saqlanadi.
export default function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Tanlang",
  clearable = false,
  loading = false,
}: {
  label: string;
  value?: string;
  options?: string[];
  onChange?: (v: string) => void;
  placeholder?: string;
  clearable?: boolean;
  /**
   * `options` hali backenddan kelayotgan bo'lsa `true`.
   *
   * Nazoratsiz rejimda (`options` berilmagan — faqat bitta qiymat
   * ko'rsatiladi) hech qachon rost bo'lmasligi kerak: u yerda so'ralayotgan
   * ro'yxat yo'q.
   */
  loading?: boolean;
}) {
  const controlled = onChange !== undefined;
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      <div className="relative">
        <select
          {...(controlled
            ? { value: value ?? "", onChange: (e) => onChange(e.target.value) }
            : {})}
          disabled={loading}
          className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70"
        >
          <option value="">{loading ? LOADING_TEXT : placeholder}</option>
          {options
            ? options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))
            : value && <option value={value}>{value}</option>}
        </select>
        {clearable && value && (
          <button
            type="button"
            onClick={() => onChange?.("")}
            className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
      </div>
    </div>
  );
}
