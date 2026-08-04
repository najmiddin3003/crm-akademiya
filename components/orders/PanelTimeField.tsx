export interface PanelTimeFieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}

export default function PanelTimeField({ label, required, value, onChange }: PanelTimeFieldProps) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="HH:mm"
          className="w-full h-11 px-3 pr-9 rounded-lg border border-border bg-secondary/30 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <svg className="icon icon-xs">
              <use href="#i-x-circle" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
