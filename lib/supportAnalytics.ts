// Nazorat → Support analitikasi (sidebar: Nazorat > Hisobotlar > Support
// analitikasi, href /nazorat-support-analytics). MongoDB `support_analytics`
// kolleksiyasi.
//
// Har bir qator — support o'qituvchisi bitta o'quvchi bilan olib borgan
// mashg'ulot yozuvi: qachon bo'lgani va o'sha seansda nechta yozuv
// (mashq/izoh) qayd etilgani.
export interface SupportRecord {
  id: number;
  studentName: string; // O'quvchi FIO
  courseName: string; // Kurs nomi
  supportTeacherName: string; // Support Teacher FIO
  date: string; // "YYYY-MM-DD" — filtrlash uchun
  time: string; // "HH:mm"
  writtenCount: number; // Yozilganlar soni
}

// "DD.MM.YYYY | HH:mm" — jadval va eksportda bir xil ko'rinish.
export function formatSupportTime(r: SupportRecord): string {
  const [y, m, d] = r.date.split("-");
  return `${d}.${m}.${y} | ${r.time}`;
}
