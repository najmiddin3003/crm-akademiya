// BOSH SAHIFA ("/home") — Dars jadvali (view-schedule).
//
// Bu sahifa allaqachon yozilgan edi, lekin faqat "/dashboard" da turardi
// va HECH QAYERDAN ochilmasdi: navbar logotipi, login, ekran qulfidan
// chiqish va yo'naltirishlar — hammasi "/tasks" ga olib borardi. Ya'ni
// tayyor bosh sahifani foydalanuvchi umuman ko'rmasdi.
//
// Endi kanonik manzil shu: "/home". Eski "/dashboard" havolalari va
// xatcho'plari buzilmasligi uchun o'sha route shu yerga yo'naltiradi.
//
// RUXSAT: "/home" — ALWAYS_ALLOWED_PATHS ichida (lib/permissions.ts).
// Usiz proxy.ts dagi sahifa qorovuli uni HAMMAGA yopib qo'yardi, chunki
// sidebar daraxtida "/home" bandi yo'q va hech bir rolda u belgilanmagan.
import SchedulePage from "@/components/schedule/SchedulePage";

export default function HomePage() {
  return <SchedulePage />;
}
