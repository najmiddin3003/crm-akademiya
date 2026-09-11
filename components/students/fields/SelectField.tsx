import Select from "@/components/ui/Select";

// O'quvchi profilidagi tanlov maydoni — yorliq + ui/Select (h-11).
//
// `options` + `onChange` berilsa haqiqiy tanlov bo'ladi; berilmasa eski
// ko'rinish (faqat bitta qiymatni ko'rsatuvchi, o'zgartirib bo'lmaydigan)
// saqlanadi.
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
  const list = options ?? (value ? [value] : []);
  return (
    <Select
      label={label}
      size="lg"
      value={value ?? ""}
      onChange={(v) => onChange?.(v)}
      options={list.map((o) => ({ value: o, label: o }))}
      placeholder={placeholder}
      clearable={clearable}
      loading={loading}
      disabled={!controlled}
    />
  );
}
