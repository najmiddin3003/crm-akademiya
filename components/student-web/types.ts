import type { StudentAppPrefs } from "@/lib/studentAppTypes";
import type { SeasonCard } from "@/lib/seasonGradeTypes";
import type { UzbmbStat } from "@/lib/studentUzbmb";
import type { CabinetFeedItem } from "@/lib/cabinetNewsTypes";
import type { AttendanceMark } from "@/lib/attendance";
import type { MonthlyExam, UzbmbExam } from "@/lib/imtihon";
import type { PaymentRow } from "@/lib/studentBot/data";
import type { PupilAddress } from "@/lib/pupilsData";
import type { StudentCabinet } from "@/lib/studentCabinetTypes";

// /api/student-web/me javobining SHAKLI — server va klient shu yerda
// uchrashadi. Alohida fayl, chunki marshrut server, komponent esa
// klient tomonda; tiplar bir joyda turmasa ular jimgina ajralib
// ketardi.

export interface StudentProfile {
  id: number;
  fullName: string;
  branch: string;
  status: string;
  role: "student" | "parent";
  category: string;
  birthDate: string;
  phone: string;
  coin: number;
  /** Jonli to'lovlar yig'indisi. Arxiv va `pupils.balance` berilmaydi — marshrutdagi izoh. */
  paid: number;
  /** 44-qism: groups/branch/course — farzand tanlash menyusi uchun (2+ farzandda). */
  kids: { id: number; name: string; groups?: number; branch?: string; course?: string }[];
}

export interface StudentGroup {
  id: number;
  name: string;
  course: string;
  level: string;
  day: string;
  time: string;
  teacher: string;
  room: string;
  eduType: string;
}

export interface StudentTask {
  id: number;
  name: string;
  type: string;
  deadline: string;
  maxScore: number;
  groupName: string;
  note: string;
}

export interface StudentMe {
  ok: true;
  profile: StudentProfile;
  groups: StudentGroup[];
  nextLesson: { groupName: string; iso: string; inDays: number; time: string } | null;
  attendance: { months: string[]; marks: AttendanceMark[] };
  payments: { rows: PaymentRow[]; totalCount: number };
  tasks: StudentTask[];
  exams: { monthly: MonthlyExam[]; uzbmb: UzbmbExam[] };
  /** Joriy oy to'lovi qayd etilganmi. */
  due: { unpaid: boolean; month: string };
  addresses: PupilAddress[];
  /**
   * Yangi kabinet (v2, 28-qism — lib/studentCabinet.ts). Hisob xato bersa null —
   * eski kabinet unga tayanmaydi va baribir ochiladi.
   */
  cabinet: StudentCabinet | null;
  /** Yangiliklar va hikoyalar (36-qism, lib/cabinetNews.ts) — shu o'quvchi/ota-onaga mo'ljallanganlari. */
  feed?: { news: CabinetFeedItem[]; stories: CabinetFeedItem[] };
  /** Oxirgi yuborilgan chorak baholari (36-qism, lib/seasonGrades.ts). */
  season?: SeasonCard[];
  /** 44-qism: UzBMB testlari bo'yicha guruh/filial o'rtachasi va o'rin (lib/studentUzbmb.ts). */
  uzbmbStats?: UzbmbStat[];
  /** Sozlamalar → O'quvchi ilovasi (38-qism). */
  appPrefs?: StudentAppPrefs;
}
