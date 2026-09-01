// +998 doim ko'rinib turadi (o'zgartirilmaydi), foydalanuvchi faqat qolgan
// 9 ta raqamni kiritadi. Operator kodi (masalan "33") qavs ichiga formatlanadi:
// "336263006" -> "(33) 626-30-06".
export function formatPhoneDigits(digits: string) {
  const d = digits.slice(0, 9);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 7);
  const p4 = d.slice(7, 9);
  let out = "";
  if (p1) out += `(${p1}${p1.length === 2 ? ")" : ""}`;
  if (p2) out += ` ${p2}`;
  if (p3) out += `-${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

/**
 * KO'RSATISH uchun: "998941558855" -> "+998 94 155 88 55".
 *
 * Yuqoridagi `formatPhoneDigits` dan farqi — u KIRITISH maydonining
 * qolipi ("(94) 155-88-55", +998 alohida turadi), bu esa bazadagi tayyor
 * 12 xonali raqamni butunligicha o'qishli qilib beradi.
 *
 * Kutilgan shaklga tushmagan qiymat (bo'sh, yoki xorijiy raqam)
 * O'ZGARISHSIZ qaytadi: raqamni o'z qolipiga majburan solib, buzib
 * ko'rsatgandan ko'ra shunisi to'g'ri.
 */
export function formatPhoneDisplay(input: string): string {
  const raw = String(input ?? "");
  const d = raw.replace(/\D/g, "");
  if (d.length !== 12 || !d.startsWith("998")) return raw;
  const n = d.slice(3); // qolgan 9 ta raqam
  return `+998 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
}

export interface PhoneFieldProps {
  label?: string;
  value: string;
  onChange: (digits: string) => void;
}

export default function PhoneField({ label = "Telefon raqam", value, onChange }: PhoneFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">{label}</label>
      <div className="auth-phone">
        <span className="auth-phone-prefix">+998</span>
        <input
          type="tel"
          inputMode="numeric"
          value={formatPhoneDigits(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
          placeholder="(90) 123-45-67"
          className="auth-phone-input"
        />
      </div>
    </div>
  );
}
