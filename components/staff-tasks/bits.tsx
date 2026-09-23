"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock, Info, Paperclip } from "lucide-react";
import {
  HOUR_MS,
  STATUS_LABEL,
  STATUS_TONE,
  ms,
  redeadlineOf,
  uzMonthOf,
  type StaffTask,
  type StaffTaskEvent,
  type StaffTaskFileRef,
  type StaffTaskStatus,
  type Tone,
} from "@/lib/staffTasks";
import type { StaffFmt } from "./format";

// Topshiriqlar sahifasining kichik ko'rinish bo'laklari (prototipdagi
// chip / muhimlik / muddat / "keyingi qadam" / tarix qatori).

export function StatusChip({ status, fmt }: { status: StaffTaskStatus; fmt: StaffFmt }) {
  return <span className={`stk-chip stk-tone-${STATUS_TONE[status]}`}>{fmt.t(STATUS_LABEL[status])}</span>;
}

export function PriorityBadge({ p, fine, fmt }: { p: number; fine?: number | null; fmt: StaffFmt }) {
  return (
    <span className={`stk-prio l${p}`}>
      <b>{p}</b>
      {fine != null && <span className="stk-prio-fine">{fmt.money(fine)}</span>}
    </span>
  );
}

/** Jadvaldagi "Muddat" katakchasi: sana + holatga qarab izoh satri. */
export function DueCell({ task, nowMs, fmt, graceHours }: { task: StaffTask; nowMs: number; fmt: StaffFmt; graceHours: number }) {
  const { t, stamp, rel, money } = fmt;
  let cls = "";
  let line = "";
  switch (task.status) {
    case "yangi":
    case "qaytarildi": {
      const left = ms(task.deadline) - nowMs;
      cls = left < 0 ? "over" : left < 6 * HOUR_MS ? "soon" : "";
      line = rel(task.deadline, nowMs);
      break;
    }
    case "muddati_otdi": {
      const rd = redeadlineOf(task, graceHours);
      cls = "over";
      line = t("Qayta muddat {stamp}, {rel}", { stamp: stamp(rd, nowMs), rel: rel(rd, nowMs) });
      break;
    }
    case "tasdiq_kutilmoqda":
      cls = "ok";
      line = t(task.isLate ? "Bajardim {stamp} (kechikib)" : "Bajardim {stamp}", { stamp: stamp(task.doneAt, nowMs) });
      break;
    case "yakunlandi":
      cls = "ok";
      line = t(task.completedLate ? "Yakunlandi {stamp} (kechikib)" : "Yakunlandi {stamp}", { stamp: stamp(task.completedAt, nowMs) });
      break;
    case "bajarilmadi":
      cls = "fail";
      line = task.fine?.status === "bekor"
        ? t("Bajarilmadi {stamp}, jarima bekor qilingan", { stamp: stamp(task.failedAt, nowMs) })
        : t("Bajarilmadi {stamp}, jarima {fine}", { stamp: stamp(task.failedAt, nowMs), fine: money(task.fine?.amount ?? task.fineAmount) });
      break;
    default:
      line = t("Bekor qilingan");
  }
  return (
    <div className={`stk-due ${cls}`}>
      <span className="d">{stamp(task.deadline, nowMs)}</span>
      <span className="rel">{line}</span>
    </div>
  );
}

/** Biriktirilgan fayllar — bosilsa server orqali yangi oynada ochiladi. */
export function FileTags({ taskId, files, kind }: { taskId: number; files: StaffTaskFileRef[]; kind: "att" | "res" }) {
  return (
    <>
      {files.map((f, i) => (
        <a
          key={`${kind}-${i}`}
          className="stk-tag"
          href={`/api/staff-tasks/${taskId}/file?k=${kind}${kind === "att" ? `&i=${i}` : ""}`}
          target="_blank"
          rel="noopener noreferrer"
          title={f.name}
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{f.name}</span>
        </a>
      ))}
    </>
  );
}

const TONE_ICON: Record<"clock" | "alert" | "check" | "info", ReactNode> = {
  clock: <Clock />,
  alert: <AlertTriangle />,
  check: <CheckCircle2 />,
  info: <Info />,
};

/**
 * "Keyingi qadam" — drawer tepasidagi rangli izoh: kim nima qilishi kerak.
 * Ijrochi (yoki boshqara olmaydigan) uchun bir matn, rahbar uchun boshqa.
 */
export function NextStep({ task, manager, nowMs, fmt, graceHours }: { task: StaffTask; manager: boolean; nowMs: number; fmt: StaffFmt; graceHours: number }) {
  const { t, stamp, rel, money, monthLabel } = fmt;
  const dl = { deadline: stamp(task.deadline, nowMs), rel: rel(task.deadline, nowMs) };
  const rd = redeadlineOf(task, graceHours);
  const fine = money(task.fine?.amount ?? task.fineAmount);
  const month = task.fine ? monthLabel(task.fine.month) : task.failedAt ? monthLabel(uzMonthOf(ms(task.failedAt))) : "";
  const fineCancelled = task.fine?.status === "bekor";
  let tone: Tone = "pri";
  let icon: keyof typeof TONE_ICON = "clock";
  let text = "";

  if (!manager) {
    switch (task.status) {
      case "yangi":
      case "qaytarildi":
        text = t("Bajarib bo'lgach «Bajardim» ni bosing — natija havolasi yoki faylini qo'shing. Rahbar tasdiqlagach yakunlanadi. Deadline: {deadline} ({rel}).", dl);
        break;
      case "muddati_otdi":
        tone = "hot";
        icon = "alert";
        text = t("Deadline o'tdi. {redeadline} gacha «Bajardim» bossangiz jarima yozilmaydi, «kechikib bajarildi» deb belgilanadi. Undan keyin {fine} jarima avtomatik yoziladi.", {
          redeadline: stamp(rd, nowMs),
          fine,
        });
        break;
      case "tasdiq_kutilmoqda":
        tone = "vio";
        text = t("Natijangiz rahbarga yuborildi — tasdiq kutilmoqda.");
        break;
      case "yakunlandi":
        tone = "ok";
        icon = "check";
        text = t(task.completedLate ? "Rahbar tasdiqladi (kechikib bajarilgan, jarimasiz)." : "Rahbar tasdiqladi.");
        break;
      case "bajarilmadi":
        tone = "bad";
        icon = "alert";
        text = fineCancelled
          ? t("Qayta muddat ham o'tdi. Jarima keyin bekor qilingan.")
          : t("Qayta muddat ham o'tdi — {fine} jarima yozildi va {month} oyligidan ushlanadi.", { fine, month });
        break;
      default:
        tone = "gray";
        icon = "info";
        text = t("Rahbar bekor qilgan — jarima yozilmaydi.");
    }
  } else {
    switch (task.status) {
      case "yangi":
        text =
          (task.seenAt
            ? t("{name} ko'rdi ({seen}).", { name: task.employeeName, seen: stamp(task.seenAt, nowMs) })
            : t("{name} hali ochmagan.", { name: task.employeeName })) +
          " " +
          t("Deadline {deadline} ({rel}); o'tsa avtomatik {grace} soat qayta muddat beriladi.", { ...dl, grace: graceHours });
        break;
      case "qaytarildi":
        tone = "amber";
        text = t("Qaytarilgan (jami {n} marta), yangi deadline {deadline} ({rel}). Xodim qayta «Bajardim» bosishi kutilmoqda.", { n: task.returnCount, ...dl });
        break;
      case "muddati_otdi":
        tone = "hot";
        icon = "alert";
        text = t("Deadline o'tdi — xodimga {grace} soat qayta muddat berildi: {redeadline} gacha ({rel}). Bajarmasa {fine} jarima avtomatik yoziladi. Kerak bo'lsa muddatni tahrirlab suring.", {
          grace: Math.round((rd - ms(task.deadline)) / HOUR_MS),
          redeadline: stamp(rd, nowMs),
          rel: rel(rd, nowMs),
          fine,
        });
        break;
      case "tasdiq_kutilmoqda":
        tone = "vio";
        icon = "check";
        text = t("Xodim natijasini tekshiring: tasdiqlang yoki izoh va yangi deadline bilan qaytaring.") +
          (task.isLate ? " " + t("Kechikib bajarilgan — tasdiqlasangiz jarima yozilmaydi.") : "");
        break;
      case "yakunlandi":
        tone = "ok";
        icon = "check";
        text = t(task.completedLate ? "Yakunlangan (kechikib bajarilgan, jarimasiz)." : "Yakunlangan, o'z vaqtida.");
        break;
      case "bajarilmadi":
        tone = "bad";
        icon = "alert";
        text = fineCancelled
          ? t("Bajarilmadi — jarima bekor qilingan.")
          : t("Bajarilmadi — {fine} jarima {month} oyligidan ushlanadi. Asosli sabab bo'lsa direktor «Jarimalar» bo'limida bekor qiladi.", { fine, month });
        break;
      default:
        tone = "gray";
        icon = "info";
        text = t("Bekor qilingan — jarima yozilmagan.");
    }
  }
  return (
    <div className={`stk-next stk-tone-${tone}`}>
      {TONE_ICON[icon]}
      <div>{text}</div>
    </div>
  );
}

/** Tarix qatorining izohi — hodisa turiga qarab, tanlangan tilda. */
export function eventDetail(e: StaffTaskEvent, fmt: StaffFmt, nowMs: number): string {
  const { t, stamp, money, monthLabel } = fmt;
  switch (e.kind) {
    case "created":
      return t("Deadline: {deadline}, muhimlik {p}", { deadline: stamp(e.deadline, nowMs), p: e.priority ?? "—" });
    case "done":
      return [e.text, e.late ? t("(kechikib)") : ""].filter(Boolean).join(" ");
    case "approved":
      return e.late ? t("Kechikib bajarildi — jarimasiz") : "";
    case "returned":
      return [e.text, t("Yangi deadline: {deadline}", { deadline: stamp(e.deadline, nowMs) })].filter(Boolean).join(" · ");
    case "overdue":
      return t("Qayta muddat: {deadline} (+{n} soat)", { deadline: stamp(e.deadline, nowMs), n: e.graceHours ?? 24 });
    case "failed":
      return e.amount
        ? t("Avtomatik jarima {fine} — {month} oyligidan", { fine: money(e.amount), month: e.month ? monthLabel(e.month) : "—" })
        : t("Jarima yozilmadi (summa 0)");
    case "cancelled":
      return e.text ?? "";
    case "fine_cancelled":
      return [e.amount ? money(e.amount) : "", e.text].filter(Boolean).join(" — ");
    case "edited":
      return (e.changes ?? [])
        .map((c) => {
          switch (c.field) {
            case "deadline":
              return t("deadline {a} → {b}", { a: stamp(String(c.from ?? ""), nowMs), b: stamp(String(c.to ?? ""), nowMs) });
            case "priority":
              return t("muhimlik {a} → {b}", { a: c.from ?? "", b: c.to ?? "" });
            case "title":
              return t("sarlavha");
            case "desc":
              return t("tavsif");
            case "link":
              return t("havola");
            case "files":
              return t("biriktirma");
            case "grace":
              return t("qayta muddat bekor qilindi");
            default:
              return "";
          }
        })
        .filter(Boolean)
        .join(", ");
    default:
      return "";
  }
}
