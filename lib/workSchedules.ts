// Boshqaruv → Ish jadvali (sidebar: Boshqaruv > Ish jadvali, href
// /management-ish-jadvali). MongoDB `work_schedules` kolleksiyasi.
//
// Xodimlarga biriktiriladigan ish rejimi shabloni: nomi, qisqa kod va
// faol/nofaol holati.
export interface WorkSchedule {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

export const WORK_SCHEDULE_STATUS_LABELS = { active: "Faol", inactive: "Nofaol" };
