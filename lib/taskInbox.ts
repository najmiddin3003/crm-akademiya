import type { TaskOutcome, TaskPriority, TaskReport, TaskTargetKind } from "./tasksData";

// XODIMNING SHAXSIY TOPSHIRIQ OYNASI — tiplar va sof yordamchilar.
//
// Bu fayl `mongodb` ni import QILMAYDI: uni route (server) ham,
// provider/modal (klient) ham o'qiydi. Ma'lumotning o'zi
// app/api/tasks/inbox/route.ts da.
//
// Qo'ng'iroq panelidan (lib/notifications.ts) FARQI: u "tizimda nima
// bo'ldi" degan umumiy lenta, bu esa "SIZGA nima topshirildi va SIZ bergan
// topshiriqqa kim nima deb javob berdi" degan shaxsiy pochta. Shu bois
// qamrovi bo'lim ruxsatiga emas, xodimning O'ZIGA bog'langan: /tasks
// sahifasini ko'rmaydigan o'qituvchi ham o'ziga berilgan topshiriqni
// ko'rishi va javob berishi kerak.

/** Oynada chiziladigan bitta topshiriq — hujjatning tor proyeksiyasi. */
export interface InboxTask {
  id: number;
  /** Kimga/nimaga (o'quvchi ismi yoki guruh). */
  student: string;
  group: string;
  targetKind: TaskTargetKind | null;
  type: string;
  description: string;
  priority: TaskPriority;
  /** `tasks.date` — xom satr (ko'rsatish uchun `dueMs` ishlatiladi). */
  date: string;
  /** Muddat — epoch ms. `null` — sana buzuq (hisoblagich chizilmaydi). */
  dueMs: number | null;
  staff: string;
  /** ISO UTC — qachon berilgan; eski yozuvlarda `null`. */
  createdAt: string | null;
  /** Kim bergan — ismi. Bo'sh satr — noma'lum (import, shablon). */
  createdByName: string;
  /** Hisobotlar ro'yxatida to'lgan; kutilayotganlarda `null`. */
  report: TaskReport | null;
}

export interface InboxPayload {
  /** Klient soati siljigan bo'lsa tuzatish uchun. */
  serverNow: string;
  /**
   * Shu sessiyaning kaliti — "oyna bu topshiriq uchun avtomatik ochildi"
   * belgisi sessionStorage'da shu kalit bilan saqlanadi. Yangi login —
   * yangi kalit, ya'ni oyna yana ochiladi (talab: "login qilib kirgandan
   * keyin modal oynasida").
   */
  sessionKey: string;
  /** Menga berilgan, hali javob berilmagan topshiriqlar (muddati yaqini birinchi). */
  pending: InboxTask[];
  /** Men bergan topshiriqlarga kelgan, hali ko'rilmagan hisobotlar (yangisi birinchi). */
  reports: InboxTask[];
}

/** POST /api/tasks/inbox tanasi. */
export interface InboxAnswer {
  id: number;
  outcome: TaskOutcome;
  comment: string;
}

/** Izohning yuqori chegarasi — bazaga cheksiz matn tushmasin. */
export const REPORT_COMMENT_MAX = 2000;

export const OUTCOME_LABELS: Record<TaskOutcome, string> = {
  bajarildi: "Bajarildi",
  bajarilmadi: "Bajarilmadi",
};
