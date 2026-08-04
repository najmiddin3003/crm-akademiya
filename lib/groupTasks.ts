// Guruh topshiriqlari (Topshiriqlar tabidagi "Topshiriq qo'shish").
// MongoDB `group_tasks` kolleksiyasi. Ustunlar crm-akademiya GROUP_TASKS'dan:
// Turi, Nomi, Topshirish muddati, O'qituvchi, Guruh, Maksimal ball, Izoh, Yaratilgan sanasi.
export interface GroupTask {
  id: number;
  groupId: number;
  type: string; // Turi: "Vazifa" | "Manba"
  name: string; // Nomi
  deadline: string; // Topshirish muddati (formatlangan)
  teacher: string; // O'qituvchi (guruhdan)
  groupName: string; // Guruh (guruhdan)
  maxScore: number; // Maksimal ball
  note: string; // Izoh
  fileName: string; // Fayl nomi (agar tanlangan bo'lsa)
  createdAt: string; // Yaratilgan sanasi
}

// datetime-local "2026-05-30T06:03" → "30.05.2026 | 06:03".
// Allaqachon formatlangan ("DD.MM.YYYY | HH:mm") bo'lsa — o'zgarmaydi.
export function formatDeadline(v: string): string {
  if (!v) return "";
  if (v.includes("T")) {
    const [date, time] = v.split("T");
    const [y, m, d] = (date || "").split("-");
    if (!y || !m || !d) return v;
    return `${d}.${m}.${y}${time ? ` | ${time.slice(0, 5)}` : ""}`;
  }
  return v;
}
