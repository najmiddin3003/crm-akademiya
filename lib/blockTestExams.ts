// Blok test → Blok testlar (block-test/exams). MongoDB `block_test_exams`
// kolleksiyasi. Har bir blok test bitta BlockTestType'ga (typeId) bog'lanadi.
export interface BlockTestExam {
  id: number;
  name: string; // Nomi
  typeId: number | null; // Tur — BlockTestType.id
  date: string; // Sana — "YYYY-MM-DD"
  startTime: string; // Boshlanish vaqti — "HH:mm"
  durationMinutes: number; // Davomiyligi (daqiqa)
  groupIds: number[]; // Guruhlar — Group.id[]
  responsibleEmployeeId: number | null; // Mas'ul xodim — HrEmployee.id
  comment: string; // Izoh
  createdAt: string; // Qo'shilgan sana — "DD.MM.YYYY | HH:mm"
}
