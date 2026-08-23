import type { LucideIcon } from "lucide-react";

// /orders-list/add sahifasidagi bo'lim sarlavhasi ("Buyurtma ma'lumotlari",
// "O'quvchi ma'lumotlari").
//
// Referens (akademiya.edutizim.uz/orders/add) o'lchamlari:
//   ikonka qutisi — 32×32, radius 8px, fon --secondary, ikonka 20px va
//                   ko'k (--primary); ikkala bo'limda ham AYNAN bir xil
//                   (ilgari bizda biri ko'k, ikkinchisi binafsha edi)
//   sarlavha      — 14px / 600, xira rang, ikonkadan 4px keyin
//   qator         — balandligi 34px (1px yuqori/quyi bo'shliq)
export default function SectionHeader({
  icon: Icon,
  title,
  // Referensda "Buyurtma ma'lumotlari" qatori 34px (py-px), ajratgichdan
  // keyingi "O'quvchi ma'lumotlari" esa 37px (pt-1 pb-px) balandlikda.
  className = "py-px",
}: {
  icon: LucideIcon;
  title: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center ${className}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon size={20} />
      </span>
      <span className="ml-1 text-sm font-semibold text-muted-foreground">{title}</span>
    </div>
  );
}
