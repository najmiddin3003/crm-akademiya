import { TA_USERS, TA_TURNSTILES, TA_TOTAL } from "@/constants/turnstile";

export interface TurnstileLog {
  id: number;
  name: string;
  userType: string;
  eventType: "Kirish" | "Chiqish";
  date: Date;
  time: string; // DD.MM.YYYY HH:MM
  plannedStart: string; // HH:MM
  plannedEnd: string; // HH:MM
  lateMin: number;
  earlyEnd: number;
  turnstile: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Ported from crm-akademiya/src/app.js TURNSTILE_LOGS IIFE (~line 29074) —
// bir xil LCG ketma-ketligi, faqat sana manbadagi qattiq "05.2026" o'rniga
// joriy oy/yilga bog'langan (Davomat qilinmagan guruhlar sahifasida
// qo'llangan yondashuv bilan bir xil — sayt qachon ochilsa ham shu davrga mos).
export function generateTurnstileLogs(): TurnstileLog[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const items: TurnstileLog[] = [];

  for (let i = 1; i <= TA_TOTAL; i++) {
    let seed = i * 9301 + 49297;
    const rnd = (min: number, max: number) => {
      seed = (seed * 9301 + 49297) % 233280;
      return Math.floor((seed / 233280) * (max - min + 1)) + min;
    };

    const user = TA_USERS[rnd(0, TA_USERS.length - 1)];
    const isEntry = rnd(0, 1) === 0;
    const plannedStartHour = rnd(8, 16);
    const plannedStartMin = rnd(0, 59);
    const plannedEndHour = plannedStartHour + 2;
    const plannedEndMin = plannedStartMin;
    const offset = rnd(-15, 25);
    const actualHour = plannedStartHour + Math.floor(offset / 60);
    const actualMin = (plannedStartMin + offset + 60) % 60;
    const lateMin = isEntry ? Math.max(0, offset) : 0;
    const earlyEnd = !isEntry ? Math.max(0, -offset) : 0;
    const day = rnd(1, 23);
    const date = new Date(year, month, day, actualHour, actualMin);

    items.push({
      id: i,
      name: user.name,
      userType: user.type,
      eventType: isEntry ? "Kirish" : "Chiqish",
      date,
      time: `${pad2(day)}.${pad2(month + 1)}.${year} ${pad2(actualHour)}:${pad2(actualMin)}`,
      plannedStart: `${pad2(plannedStartHour)}:${pad2(plannedStartMin)}`,
      plannedEnd: `${pad2(plannedEndHour)}:${pad2(plannedEndMin)}`,
      lateMin,
      earlyEnd,
      turnstile: TA_TURNSTILES[rnd(0, TA_TURNSTILES.length - 1)],
    });
  }
  return items;
}
