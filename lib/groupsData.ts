// "Guruhga qo'shish" tugmasi bosilganda ochiladigan tanlov ro'yxati
// (components/orders/GroupPickerModal.tsx). Hozircha guruhlar uchun backend
// yo'q — foydalanuvchining o'z so'zi bilan "hozircha default yozib turamiz"
// — shu bois qattiq yozilgan demo ro'yxat (birinchi beshtasi
// akademiya.edutizim.uz referensidagi bilan bir xil).

export interface GroupOption {
  id: number;
  level: string;
  dayPattern: string;
  timeRange: string;
  teacher: string;
}

export const DEMO_GROUPS: GroupOption[] = [
  { id: 14, level: "1-bosqich", dayPattern: "Ya,Pa", timeRange: "08:00 - 10:00", teacher: "Musoxon Maxamadaliyev" },
  { id: 87, level: "4-bosqich", dayPattern: "Chor", timeRange: "08:00 - 10:00", teacher: "Abdushukur Abdug'aniyev" },
  { id: 89, level: "2-bosqich", dayPattern: "Se,Sh", timeRange: "16:00 - 18:00", teacher: "Musoxon Maxamadaliyev" },
  { id: 93, level: "2-bosqich", dayPattern: "Ya,Ch", timeRange: "16:00 - 18:00", teacher: "Yaxyoxo'ja Yigitaliyev" },
  { id: 65, level: "2-bosqich", dayPattern: "Se,Sh", timeRange: "14:00 - 16:00", teacher: "Yaxyoxo'ja Yigitaliyev" },
  { id: 22, level: "3-bosqich", dayPattern: "Du,Ch,Ju", timeRange: "10:00 - 12:00", teacher: "Hasanboy Obidov" },
  { id: 41, level: "1-bosqich", dayPattern: "Du,Se,Ch,Pa,Ju", timeRange: "18:00 - 20:00", teacher: "Sevinch Madaminova" },
  { id: 58, level: "5-bosqich (CEFR / IELTS)", dayPattern: "Juft kunlar", timeRange: "09:00 - 11:00", teacher: "Ilhomjon Sharabidinov" },
];
