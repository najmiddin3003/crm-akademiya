import type { FirstLessonFollowUp, FirstLessonReminder } from "@/lib/ordersData";

// PATCH /api/orders/:id — «Birinchi darsga yozilganlar» (yangi versiya, 22-qism)
// yozadigan ikki maydonni tekshiradi va KIM/QACHON ni server o'zi qo'yadi:
//   firstLessonReminder — dars oldidan eslatish natijasi;
//   firstLessonFollowUp — «Kelmadi» dan keyin operator qo'ng'irog'i.
// `null` — maydon tozalanadi. Boshqa shakl — xato (hech narsa yozilmaydi).

const REMINDER_RESULTS = new Set(["eslatildi", "tasdiqladi", "javob_yoq"]);
const DUE_RE = /^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** `patch` ni joyida o'zgartiradi; xato bo'lsa — matni, aks holda null. */
export function stampFirstLessonFields(patch: Record<string, unknown>, by: string): string | null {
  const at = new Date().toISOString();

  if ("firstLessonReminder" in patch) {
    const v = patch.firstLessonReminder;
    if (v !== null) {
      if (!v || typeof v !== "object" || Array.isArray(v)) return "Eslatish ma'lumoti noto'g'ri";
      const o = v as Record<string, unknown>;
      let out: FirstLessonReminder;
      if (o.off === true) out = { off: true, at, by };
      else if (typeof o.result === "string" && REMINDER_RESULTS.has(o.result)) out = { result: o.result as FirstLessonReminder["result"], at, by };
      else return "Eslatish natijasi noto'g'ri";
      patch.firstLessonReminder = out;
    }
  }

  if ("firstLessonFollowUp" in patch) {
    const v = patch.firstLessonFollowUp;
    if (v !== null) {
      if (!v || typeof v !== "object" || Array.isArray(v)) return "Keyingi qadam ma'lumoti noto'g'ri";
      const o = v as Record<string, unknown>;
      // Mas'ul bo'lmasa — belgilagan xodimning o'zi.
      const assignee = str(o.assignee, 120) || by;
      const due = str(o.due, 16);
      if (o.kind !== "call" || !assignee || !DUE_RE.test(due)) return "Keyingi qadam ma'lumoti noto'g'ri";
      const note = str(o.note, 300);
      const out: FirstLessonFollowUp = { kind: "call", assignee, due, ...(note ? { note } : {}), at, by };
      patch.firstLessonFollowUp = out;
    }
  }
  return null;
}
