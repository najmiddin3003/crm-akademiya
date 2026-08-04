// "O'quvchi qo'shish" (AddStudentModal) orqali qo'shilgan o'quvchilar —
// MongoDB'dagi alohida "pupils" kolleksiyasida saqlanadi (constants/index.js
// dagi statik 50 ta STUDENTS demo ro'yxatidan ajratilgan holda — bular
// haqiqiy, foydalanuvchi tomonidan qo'shilgan yozuvlar).

export interface Pupil {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  extraPhone: string;
  category: string;
  birthDate: string;
  createdAt: string;
}

export interface NewPupilValues {
  firstName: string;
  lastName: string;
  phone: string;
  extraPhone: string;
  category: string;
  birthDate: string;
}

export function buildPupilFromValues(nextId: number, values: NewPupilValues): Pupil {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const createdAt = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} | ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return { id: nextId, ...values, createdAt };
}
