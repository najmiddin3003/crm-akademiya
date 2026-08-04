export interface DvaDay {
  date: Date;
  label: string; // DD.MM.YYYY
  vals: [number, number, number, number, number, number];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Ported from crm-akademiya/src/app.js DVA_DAILY (~line 28449): manbadagi
// qo'lda yozilgan namunada yakshanba kunlari deyarli bo'sh (masalan 10.05,
// 17.05 — "Umumiy soni" 99 dan boshqa hammasi 0), oxirgi kun (bugungi kun)
// esa "Davomat qilinmagan" ustuni 0 — chunki kun hali tugamagan. Shu ikki
// qoidani deterministik generatorda ham saqlab qoldik (backend yo'q).
function genDay(dayIndex: number, dow: number, isToday: boolean): [number, number, number, number, number, number] {
  if (dow === 0) return [0, 0, 0, 0, 0, isToday ? 0 : 20 + (dayIndex % 30)];
  const kelgan = 15 + ((dayIndex * 37) % 55);
  const sababli = dayIndex % 11 === 0 ? 1 : 0;
  const sababsiz = dayIndex % 5 === 0 ? dayIndex % 7 : 0;
  const qilinmagan = isToday ? 0 : 340 + ((dayIndex * 53) % 100);
  return [kelgan, sababli, sababsiz, 0, 0, qilinmagan];
}

export function generateDvaRange(start: Date, end: Date): DvaDay[] {
  const days: DvaDay[] = [];
  const today = new Date();
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  let i = 0;
  while (cur.getTime() <= last.getTime()) {
    days.push({
      date: new Date(cur),
      label: `${pad2(cur.getDate())}.${pad2(cur.getMonth() + 1)}.${cur.getFullYear()}`,
      vals: genDay(i, cur.getDay(), isSameDay(cur, today)),
    });
    cur.setDate(cur.getDate() + 1);
    i++;
  }
  return days;
}

export function dvaTotals(days: DvaDay[]): [number, number, number, number, number, number] {
  const totals: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  for (const d of days) {
    for (let k = 0; k < 6; k++) totals[k] += d.vals[k];
  }
  return totals;
}

export function fmtCount(n: number): string {
  return n.toLocaleString("ru-RU").replace(/,/g, " ");
}
