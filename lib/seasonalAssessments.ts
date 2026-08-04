// O'quv bo'limi → Mavsumiy baholash. MongoDB `seasonal_assessments`
// kolleksiyasi. Har bir yozuv — bitta o'quvchining bitta oydagi bahosi
// (guruh/kurs/o'quvchi ma'lumotlari yaratilish vaqtidagi snapshot, keyinchalik
// guruh/o'quvchi o'chirilsa ham yozuv o'zgarmaydi).
export interface SeasonalAssessment {
  id: number;
  month: number; // 1-12
  course: string;
  groupId: number;
  groupName: string;
  teacher: string;
  studentId: number;
  studentName: string;
  ball: number;
  izoh: string;
}

export interface SeasonalAssessmentEntry {
  studentId: number;
  studentName: string;
  ball: number;
  izoh: string;
}
