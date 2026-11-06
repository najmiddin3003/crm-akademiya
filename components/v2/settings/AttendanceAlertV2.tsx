"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import EmployeeToggle from "@/components/employees/EmployeeToggle";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import type { AlertCandidate } from "@/lib/attendanceAlert";
import { ApiError, fetchJson } from "@/lib/fetchJson";

// SOZLAMALAR → NAZORAT → «NAZORAT QOIDALARI» (`/settings-academic?tab=nazorat`, 06.11.2026).
// Davomat qilinmagan guruhlar haqida rahbarga bot xabari: yoqish/o'chirish va kimga borishi.
// Qoida va sabablari — lib/attendanceAlert.ts, yuborish — lib/staffBot/dayReminders.ts.
//
// Faqat ADMIN o'zgartiradi (app/api/attendance-alert → requireAdmin); boshqa xodim sahifani ochsa
// sababini ko'radi. Har o'zgarish darhol saqlanadi va ekran server javobidan yangilanadi — saqlanmasa
// belgi o'z joyida qoladi.

type CandidateRow = Omit<AlertCandidate, "branchIds"> & { branches: string[] | null };

interface AlertView {
  enabled: boolean;
  selected: number[];
  candidates: CandidateRow[];
  botReady: boolean;
  muted: boolean;
  afterMin: number;
}

const URL = "/api/attendance-alert";

function Note({ children }: { children: string }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-small text-v2-text">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-v2-warning" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export default function AttendanceAlertV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<AlertView | null>(null);
  const [problem, setProblem] = useState<"denied" | "failed" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchJson<AlertView>(URL)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setProblem(e instanceof ApiError && e.status === 403 ? "denied" : "failed");
      });
    return () => {
      alive = false;
    };
  }, []);

  async function save(patch: { enabled?: boolean; recipients?: number[] }, done?: string) {
    setSaving(true);
    try {
      setData(await fetchJson<AlertView>(URL, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }));
      if (done) showSuccess(done);
    } catch {
      showError(t("Saqlanmadi"));
    } finally {
      setSaving(false);
    }
  }

  function toggle(view: AlertView, chatId: number, on: boolean) {
    const next = view.selected.filter((id) => id !== chatId);
    void save({ recipients: on ? [...next, chatId] : next });
  }

  const known = data ? new Set(data.candidates.filter((c) => !c.blocked).map((c) => c.chatId)) : new Set<number>();
  const nobody = !!data && !data.selected.some((id) => known.has(id));

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      <div className="min-w-0 max-w-[44rem]">
        <div className="text-v2-caption text-v2-text-2">{t("Nazorat")}</div>
        <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Nazorat qoidalari")}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Rahbarga avtomatik xabarlar.")}</p>
      </div>

      {problem && <p className="text-v2-small text-v2-text-2">{t(problem === "denied" ? "Faqat administrator uchun" : "Yuklanmadi")}</p>}
      {!data && !problem && <Loader2 className="size-5 animate-spin text-v2-text-2" aria-label={t("Yuklanmoqda...")} />}

      {data && (
        <section className="max-w-[44rem] rounded-v2-lg border border-v2-border bg-v2-surface p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-v2-section text-v2-text">{t("Davomat qilinmagan guruhlar")}</h2>
              <p className="mt-1 text-v2-small text-v2-text-2">
                {t("Dars tugagach {n} daqiqa o'tib ham davomat belgilanmasa, xodimlar botida xabar keladi: guruh, ustoz va telefoni, vaqti, xonasi, filiali, o'quvchilar soni.", {
                  n: data.afterMin,
                })}
              </p>
            </div>
            <div className="shrink-0">
              <EmployeeToggle
                checked={data.enabled}
                disabled={saving}
                title={t("Davomat qilinmagan guruhlar")}
                onChange={(on) => void save({ enabled: on }, t(on ? "Xabar yoqildi" : "Xabar o'chirildi"))}
              />
            </div>
          </div>

          {data.muted ? (
            <Note>{t("Bu sinov sayti: bu yerdan bot hech kimga yozmaydi.")}</Note>
          ) : (
            !data.botReady && <Note>{t("Xodimlar boti sozlanmagan — xabar bormaydi.")}</Note>
          )}
          {data.enabled && data.candidates.length > 0 && nobody && <Note>{t("Hech kim tanlanmagan — xabar bormaydi.")}</Note>}

          <div className="mt-5 border-t border-v2-border pt-4">
            <h3 className="text-v2-body font-medium text-v2-text">{t("Kimga yuboriladi")}</h3>
            <p className="mt-0.5 text-v2-small text-v2-text-2">
              {t("Ro'yxatda botga kirgan xodimlar bor, o'qituvchilarsiz. Admin hamma filialni, boshqalar o'z filialini oladi.")}
            </p>
            {data.candidates.length === 0 ? (
              <Note>{t("Botga kirgan rahbar yo'q — avval xodimlar botiga kirsin.")}</Note>
            ) : (
              <ul className="mt-2 divide-y divide-v2-border">
                {data.candidates.map((c) => (
                  <li key={c.chatId}>
                    <label className="flex cursor-pointer items-center gap-3 py-2.5">
                      <V2Checkbox
                        checked={data.selected.includes(c.chatId)}
                        disabled={saving}
                        label={c.name}
                        onChange={(on) => toggle(data, c.chatId, on)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-v2-body text-v2-text">{c.name}</span>
                        <span className="block truncate text-v2-small text-v2-text-2">
                          {[c.branches === null ? t("Barcha filiallar") : c.branches.join(", "), c.tgName, c.blocked ? t("Botni to'xtatgan") : ""].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
