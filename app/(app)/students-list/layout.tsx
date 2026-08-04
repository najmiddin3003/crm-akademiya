import { PupilsProvider } from "@/components/orders/PupilsContext";

// "O'quvchi qo'shish" shu yerda orders-list bilan bir xil PupilsContext'ni
// ishlatadi (AddStudentModal → /api/pupils), shu sabab shu route segmentiga
// ham ulanadi — mos ravishda qo'shilgan o'quvchi ikkala sahifada ham ko'rinadi.
export default function StudentsListLayout({ children }: { children: React.ReactNode }) {
  return <PupilsProvider>{children}</PupilsProvider>;
}
