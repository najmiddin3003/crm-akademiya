"use client";

import TimeField, { normalizeTime } from "@/components/ui/TimeField";

// Yangi buyurtma panelidagi vaqt maydoni — yorliq + ui/TimeField (h-11).
// Ilgari native <input type="time"> edi (brauzerning o'z soat tanlagichi);
// endi loyihadagi qo'lda yasalgan soat/daqiqa tanlagich. Qiymat "HH:mm".
export { normalizeTime };

export interface PanelTimeFieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}

export default function PanelTimeField({ label, required, value, onChange }: PanelTimeFieldProps) {
  return <TimeField label={label} required={required} value={normalizeTime(value)} onChange={onChange} variant="panel" />;
}
