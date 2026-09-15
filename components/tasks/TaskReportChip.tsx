import type { TaskReport } from "@/lib/tasksData";

// Kartadagi HISOBOT CHIPI — mas'ul xodim topshiriqqa qanday javob bergani
// (components/shared/TaskInboxModal.tsx orqali). Ayniqsa "Bajarilmadi"
// uchun kerak: bunday topshiriq kanbanda "Kutilmoqda" ustunida turadi va
// chipsiz u nega o'sha yerdaligi ko'rinmasdi. Izohning o'zi tooltip'da,
// to'liq matn tahrirlash oynasida (TaskModal).
export default function TaskReportChip({ report }: { report?: TaskReport }) {
  if (!report) return null;
  const done = report.outcome === "bajarildi";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"}`}
      title={`${report.byName || "Mas'ul"}: ${report.comment}`}
    >
      {done ? "✓ Bajarildi" : "✗ Bajarilmadi"}
      {report.byName && <span className="font-normal opacity-80">· {report.byName.split(" ")[0]}</span>}
    </span>
  );
}
