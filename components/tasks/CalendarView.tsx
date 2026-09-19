"use client";

import { compareTasksForSort, type Task } from "@/lib/tasksData";
import { useT } from "@/components/shared/Language";

export interface CalendarViewProps {
  month: Date;
  tasks: Task[];
  onNavigate: (delta: number) => void;
  onToday: () => void;
  onDayClick: (year: number, month: number, day: number) => void;
  onTaskClick: (id: number) => void;
}

export default function CalendarView({ month, tasks, onNavigate, onToday, onDayClick, onTaskClick }: CalendarViewProps) {
  const { t, months, weekdaysShort } = useT();
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay = new Date(year, monthIdx + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const tasksByDay = new Map<number, Task[]>();
  for (const tv of tasks) {
    const d = new Date(tv.date);
    if (isNaN(d.getTime())) continue;
    if (d.getFullYear() === year && d.getMonth() === monthIdx) {
      const key = d.getDate();
      const arr = tasksByDay.get(key) || [];
      arr.push(tv);
      tasksByDay.set(key, arr);
    }
  }

  const today = new Date();
  const isCurMonth = today.getFullYear() === year && today.getMonth() === monthIdx;

  const cells = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - startWeekday + 1;
    const isOutside = dayNum < 1 || dayNum > daysInMonth;
    const isToday = isCurMonth && dayNum === today.getDate();
    const dayTasks = (tasksByDay.get(dayNum) || []).slice().sort(compareTasksForSort);
    return { key: i, dayNum, isOutside, isToday, dayTasks };
  });

  return (
    <div>
      <div className="calendar-toolbar">
        <button className="calendar-nav-btn" onClick={() => onNavigate(-1)} title={t("Oldingi oy")}>
          <svg className="icon icon-sm"><use href="#i-arrow-left" /></svg>
        </button>
        <div className="calendar-month-title">{months[monthIdx]} {year}</div>
        <button className="calendar-nav-btn" onClick={() => onNavigate(1)} title={t("Keyingi oy")}>
          <svg className="icon icon-sm"><use href="#i-arrow-right" /></svg>
        </button>
        <button className="calendar-today-btn" onClick={onToday}>{t("Bugun")}</button>
      </div>

      <div className="calendar-weekdays">
        {[...weekdaysShort.slice(1), weekdaysShort[0]].map((w) => (
          <div key={w} className="calendar-weekday">{w}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map(({ key, dayNum, isOutside, isToday, dayTasks }) => (
          <div
            key={key}
            className={`calendar-cell ${isOutside ? "outside" : ""} ${isToday ? "today" : ""}`}
            onClick={isOutside ? undefined : () => onDayClick(year, monthIdx, dayNum)}
          >
            {!isOutside && (
              <div className="calendar-cell-date">
                <span>{dayNum}</span>
                {dayTasks.length > 0 && <span className="calendar-cell-date-count">{dayTasks.length}</span>}
              </div>
            )}
            <div className="calendar-cell-tasks">
              {dayTasks.slice(0, 3).map((tv) => {
                const completed = tv.state === "bajarilgan" ? " completed" : "";
                const firstName = tv.student.split(/\s+/)[0] || "";
                return (
                  <div
                    key={tv.id}
                    className={`calendar-chip priority-${tv.priority}${completed}`}
                    onClick={(e) => { e.stopPropagation(); onTaskClick(tv.id); }}
                    title={`${tv.student} — ${tv.description}`}
                  >
                    {firstName}
                  </div>
                );
              })}
              {dayTasks.length > 3 && <div className="calendar-more">+{dayTasks.length - 3} ko&apos;proq</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
