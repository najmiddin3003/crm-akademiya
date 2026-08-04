import { MG_TEACHERS, MG_GROUP_NAMES, MG_TOTAL } from "@/constants/missedGroups";

export interface MissedGroup {
  id: number;
  name: string;
  date: Date;
  dateLabel: string; // DD.MM.YYYY | 05:00
  teacher: string;
  // Davomat qilinmagan dars uchun yo'qotilgan tushum — sahifa yuqorisidagi
  // "Jami summa" shu maydonlar yig'indisi (referens saytdagi kabi). Qolgan
  // maydonlar kabi bir xil LCG'dan, shuning uchun yig'indi barqaror.
  amount: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Ported from crm-akademiya/src/app.js getMissedGroupsForPage() (~line 28852):
// 50 ta yozuv/kun, eng yangi kundan orqaga qarab. Manbada sana qattiq
// "23.05.2026"ga bog'langan edi — bu yerda "bugungi kun"ga bog'langan
// (foydalanuvchi so'rovi: sayt qachon ochilsa ham shu kundan boshlanishi
// kerak), shuning uchun har safar ochilganda avtomatik yangilanadi.
export function generateMissedGroups(): MissedGroup[] {
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const items: MissedGroup[] = [];
  for (let idx = 0; idx < MG_TOTAL; idx++) {
    let seed = (idx + 1) * 9301 + 49297;
    const rnd = (min: number, max: number) => {
      seed = (seed * 9301 + 49297) % 233280;
      return Math.floor((seed / 233280) * (max - min + 1)) + min;
    };
    const dayOffset = Math.floor(idx / 50);
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset);
    items.push({
      id: idx + 1,
      name: MG_GROUP_NAMES[rnd(0, MG_GROUP_NAMES.length - 1)],
      date,
      dateLabel: `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()} | 05:00`,
      teacher: MG_TEACHERS[rnd(0, MG_TEACHERS.length - 1)],
      amount: rnd(8, 40) * 50000,
    });
  }
  return items;
}
