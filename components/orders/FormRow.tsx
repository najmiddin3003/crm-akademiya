// Compact "label left, value right" row fields used by the full-page
// /orders-list/add form (akademiya.edutizim.uz/orders/add reference) — a
// visually distinct, denser style from the boxed inputs used in the
// AddOrderModal side drawer, ported as its own look rather than reusing that
// drawer's field components.

export interface FormRowSelectProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export function FormRowSelect({ label, required, value, onChange, options, placeholder = "..." }: FormRowSelectProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}:
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none border-none bg-transparent pr-3 text-sm text-muted-foreground text-right cursor-pointer focus:outline-none"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <svg className="icon icon-xs pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground">
          <use href="#i-chevron-down" />
        </svg>
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
    <div className="flex items-center justify-between py-3 border-b border-border">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}:
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-none bg-transparent text-sm text-right focus:outline-none w-40"
      />
    </div>
  );
}
