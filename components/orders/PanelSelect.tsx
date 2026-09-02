import { LOADING_TEXT } from "@/lib/selectPlaceholder";

export interface PanelSelectProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  error?: boolean;
  /** Ro'yxat hali backenddan kelayotgan bo'lsa `true`. */
  loading?: boolean;
}

export default function PanelSelect({ label, required, value, onChange, options, placeholder = "Tanlang", error, loading }: PanelSelectProps) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          className={`w-full h-11 px-3 pr-9 rounded-lg border bg-secondary/30 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70 ${error ? "border-red-400 ring-2 ring-red-400" : "border-border"}`}
        >
          <option value="">{loading ? LOADING_TEXT : placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <use href="#i-chevron-down" />
        </svg>
      </div>
    </div>
  );
}
