"use client";

import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { ms, uzDateOf, uzTimeOf } from "@/lib/staffTasks";

// YANGI VERSIYA — XODIM PROFILI → «FACE ID» (30.10.2026, lib/staffFace.ts).
// FAQAT ADMIN ko'radi (biometrik rasm): ro'yxatga olish rasmi va sanasi,
// so'nggi urinishlar (rasm, natija, masofa — kichigi o'xshashroq), «Face ID
// talab qilinmasin» (telefoni kamerani ochmaydigan xodim) va «Yuzni o'chirish» —
// xodim keyingi «Ishga keldim» da qayta ro'yxatdan o'tadi (masalan, ro'yxatga
// boshqa odam yuzi tushib qolgan bo'lsa).

interface Shot {
  id: string;
  at: string;
  purpose: "enroll" | "verify";
  ok: boolean;
  distance: number | null;
  reason: string | null;
  photo: string | null;
  attendance: { kind: "in" | "out" } | null;
}

interface FaceData {
  faceRequired: boolean;
  threshold: number;
  enrolled: boolean;
  enrolledAt: string | null;
  exempt: boolean;
  photo: string | null;
  shots: Shot[];
}

export default function EmployeeFaceCard({ employeeId }: { employeeId: number }) {
  const { t, months } = useT();
  const { showSuccess, showError } = useToast();
  /** null — yuklanmoqda; undefined — olib bo'lmadi. */
  const [data, setData] = useState<FaceData | null | undefined>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hr-employees/${employeeId}/face`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d?.ok ? (d as FaceData) : undefined);
      })
      .catch(() => {
        if (!cancelled) setData(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, version]);

  const stamp = (iso: string | null | undefined) => {
    const v = ms(iso);
    if (!Number.isFinite(v)) return "";
    const d = uzDateOf(v);
    return `${Number(d.slice(8, 10))}-${(months[Number(d.slice(5, 7)) - 1] ?? "").toLowerCase()} | ${uzTimeOf(v)}`;
  };

  const shotLabel = (s: Shot): string => {
    if (s.purpose === "enroll") {
      if (s.ok) return t("Ro'yxatga olindi");
      if (s.reason?.startsWith("duplicate")) return t("Rad etildi: boshqa xodimning yuzi");
      return t("Rad etildi: kadrlarda yuz bir xil emas");
    }
    if (!s.ok) return t("Mos kelmadi");
    if (s.attendance?.kind === "in") return t("Tasdiqlandi · ishga keldi");
    if (s.attendance?.kind === "out") return t("Tasdiqlandi · ishdan ketdi");
    return t("Tasdiqlandi");
  };

  async function call(method: "PATCH" | "DELETE", body?: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/hr-employees/${employeeId}/face`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      }).then((r) => r.json());
      if (!res?.ok) {
        showError(t(res?.error || "Saqlanmadi"));
        return false;
      }
      setVersion((v) => v + 1);
      return true;
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleExempt(next: boolean) {
    if (await call("PATCH", { exempt: next })) {
      showSuccess(next ? t("Bu xodimdan endi Face ID talab qilinmaydi") : t("Bu xodimga Face ID qayta yoqildi"));
    }
  }

  async function reset() {
    if (await call("DELETE")) {
      setConfirming(false);
      showSuccess(t("Yuz o'chirildi — xodim keyingi safar qayta ro'yxatdan o'tadi"));
    }
  }

  const pill = !data
    ? null
    : data.exempt
      ? { text: t("Ozod"), cls: "bg-v2-warning-bg text-v2-warning" }
      : data.enrolled
        ? { text: t("Ro'yxatdan o'tgan"), cls: "bg-v2-success-bg text-v2-success" }
        : { text: t("Ro'yxatdan o'tmagan"), cls: "bg-v2-surface-2 text-v2-text-2" };

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm" aria-label={t("Face ID")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-v2-section text-v2-text">
          <ScanFace className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
          {t("Face ID")}
        </h2>
        {pill && <span className={`inline-flex h-6 items-center rounded-v2-sm px-2 text-v2-caption font-medium ${pill.cls}`}>{pill.text}</span>}
      </div>

      {data === null ? (
        <div className="mt-4 flex items-center gap-3" aria-hidden>
          <div className="size-14 rounded-v2-md bg-v2-skeleton" />
          <div className="h-3 flex-1 rounded bg-v2-skeleton" />
        </div>
      ) : data === undefined ? (
        <p className="mt-3 text-v2-small text-v2-text-3">{t("Ma'lumot olinmadi.")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {!data.faceRequired && (
            <p className="rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-caption text-v2-text-2">
              {t("Face ID hozir o'chiq — Nazorat → «Ishga keldim» sahifasida yoqiladi.")}
            </p>
          )}

          <div className="flex items-center gap-3">
            {data.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL (bazadagi kichik JPEG)
              <img src={data.photo} alt={t("Ro'yxatga olingan yuz")} className="size-14 shrink-0 rounded-v2-md object-cover" />
            ) : (
              <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-v2-md bg-v2-surface-2 text-v2-text-3">
                <ScanFace className="size-6" strokeWidth={1.5} aria-hidden />
              </span>
            )}
            <p className="min-w-0 text-v2-small text-v2-text-2">
              {data.enrolled
                ? t("Ro'yxatga olingan: {when}", { when: stamp(data.enrolledAt) })
                : t("Hali ro'yxatdan o'tmagan — birinchi «Ishga keldim» da o'tadi.")}
            </p>
          </div>

          {data.shots.length > 0 && (
            <div>
              <p className="text-v2-caption font-medium text-v2-text-3">{t("So'nggi urinishlar")}</p>
              <ul className="mt-1 divide-y divide-v2-border">
                {data.shots.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-2">
                    {s.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data: URL
                      <img src={s.photo} alt="" className="size-10 shrink-0 rounded-v2-sm object-cover" />
                    ) : (
                      <span className="size-10 shrink-0 rounded-v2-sm bg-v2-surface-2" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-v2-small font-medium ${s.ok ? "text-v2-text" : "text-v2-danger"}`}>{shotLabel(s)}</span>
                      <span className="block truncate text-v2-caption text-v2-text-3">{stamp(s.at)}</span>
                    </span>
                    {s.distance !== null && (
                      <span
                        className="shrink-0 text-v2-caption tabular-nums text-v2-text-3"
                        title={t("Yuzlar orasidagi masofa — kichigi o'xshashroq (chegara {th})", { th: data.threshold })}
                      >
                        {s.distance.toFixed(2)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-v2-small text-v2-text">
            <V2Checkbox
              checked={data.exempt}
              disabled={busy}
              onChange={(v) => void toggleExempt(v)}
              label={t("Face ID talab qilinmasin")}
            />
            <span>{t("Face ID talab qilinmasin")}</span>
          </label>

          {data.enrolled &&
            (confirming ? (
              <div className="flex flex-wrap items-center gap-2 rounded-v2-md bg-v2-danger-bg px-3 py-2">
                <span className="text-v2-small text-v2-danger">{t("Yuz o'chirilsinmi? Xodim keyingi safar qayta ro'yxatdan o'tadi.")}</span>
                <span className="ml-auto flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void reset()} className={`${secondaryBtn} border-v2-danger text-v2-danger`}>
                    {t("Ha, o'chirish")}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryBtn}>
                    {t("Bekor qilish")}
                  </button>
                </span>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={secondaryBtn}>
                {t("Yuzni o'chirish")}
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
