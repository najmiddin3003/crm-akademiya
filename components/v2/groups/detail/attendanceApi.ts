import type { AttendanceMark, AttendanceStatus } from "@/lib/attendance";

// YANGI VERSIYA — GURUH SAHIFASI: davomat belgisini yozish (POST /api/groups/:id/attendance,
// eski jadval bilan bir xil so'rov — tarix, gamifikatsiya hodisasi, o'quvchilar boti
// lib/attendanceWrite.ts da). «Bugungi dars» va «Davomat jurnali» uchun umumiy.

export interface MarkBody {
  pupilId: number;
  date: string;
  /** null — belgi olib tashlanadi. */
  status: AttendanceStatus | null;
  grade: number | null;
  reason: string | null;
  note: string | null;
}

export async function postMark(groupId: number, body: MarkBody): Promise<{ ok: true; mark: AttendanceMark | null } | { ok: false; error: string }> {
  try {
    const r = await fetch(`/api/groups/${groupId}/attendance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (d?.ok) return { ok: true, mark: (d.mark ?? null) as AttendanceMark | null };
    return { ok: false, error: d?.error || "Davomat saqlanmadi" };
  } catch {
    return { ok: false, error: "Serverga ulanib bo'lmadi" };
  }
}

/** Belgini ro'yxatda almashtiradi (null — olib tashlaydi). */
export function upsertMark(list: AttendanceMark[], pupilId: number, date: string, mark: AttendanceMark | null): AttendanceMark[] {
  const rest = list.filter((x) => !(x.pupilId === pupilId && x.date === date));
  return mark ? [...rest, mark] : rest;
}

const ABSENT: AttendanceStatus[] = ["sababli", "sababsiz"];

/**
 * Holat almashganda qolgan maydonlar: baho saqlanadi; sabab — sababli qolsa; izoh —
 * darsda yo'qligicha qolsa (server ham shu qoidada: lib/attendanceWrite.ts).
 */
export function carryOver(prev: AttendanceMark | undefined, status: AttendanceStatus | null): Pick<MarkBody, "grade" | "reason" | "note"> {
  return {
    grade: prev?.grade ?? null,
    reason: status === "sababli" && prev?.status === "sababli" ? (prev.reason ?? null) : null,
    note: status && ABSENT.includes(status) && prev && ABSENT.includes(prev.status) ? (prev.note ?? null) : null,
  };
}
