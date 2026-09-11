import Select from "@/components/ui/Select";

// Yangi buyurtma panelidagi tanlov maydoni — yorliq + ui/Select (h-11).
// Ilgari native <select> edi; endi loyihadagi yagona qo'lda yasalgan
// ro'yxat (qidiruv uzun ro'yxatda o'zi chiqadi, tungi rejimga mos).
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
    <Select
      label={label}
      required={required}
      size="lg"
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o, label: o }))}
      placeholder={placeholder}
      error={error}
      loading={loading}
      clearable
    />
  );
}
