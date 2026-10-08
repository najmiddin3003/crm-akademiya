"use client";

import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { ApiError, fetchJson } from "@/lib/fetchJson";
import { uzStamp } from "@/lib/uzTime";
import type { AiSettings } from "@/lib/ai/settings";
import { Toggle } from "./SettingsForm";
import SettingsNote from "./SettingsNote";

// Sozlamalar → Ilova sozlamalari → AI yordamchi (07.10.2026).
//
// Faqat ADMIN o'zgartiradi (app/api/ai/settings → requireAdmin); boshqa
// xodim tabni ochsa sababini ko'radi. Har o'zgarish darhol saqlanadi
// (Gamifikatsiya → Umumiy bilan bir xil xulq).
//
// Kalitning O'ZI bu yerda ko'rinmaydi va kiritilmaydi — u serverdagi
// .env.local da (OPENAI_URL_API). Sahifa faqat "bor/yo'q" va model nomini
// ko'rsatadi.

interface SettingsResponse {
  settings: AiSettings;
  configured: boolean;
  model: string | null;
}

const cardCls = "rounded-2xl border border-border bg-card p-4 md:p-5";

export default function AiAssistantTab() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [limitDraft, setLimitDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchJson<SettingsResponse & { ok: boolean }>("/api/ai/settings")
      .then((d) => {
        if (!alive) return;
        setData({ settings: d.settings, configured: d.configured, model: d.model });
        setLimitDraft(String(d.settings.dailyLimit));
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 403) setDenied(true);
        else setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function save(patch: { enabled?: boolean; actionsEnabled?: boolean; dailyLimit?: number }): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        showError(d?.error || "Saqlab bo'lmadi");
        return false;
      }
      setData((prev) => (prev ? { ...prev, settings: d.settings as AiSettings } : prev));
      showSuccess("Saqlandi");
      return true;
    } catch {
      showError("Serverga ulanib bo'lmadi");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function commitLimit() {
    if (!data) return;
    const n = Number(limitDraft);
    if (limitDraft.trim() === String(data.settings.dailyLimit)) return;
    if (!(await save({ dailyLimit: n }))) setLimitDraft(String(data.settings.dailyLimit));
  }

  if (denied) return <SettingsNote>{t("Bu sozlamani faqat administrator o'zgartira oladi.")}</SettingsNote>;
  if (failed) return <SettingsNote>{t("Ma'lumotni yuklab bo'lmadi")}</SettingsNote>;
  if (!data) return <SpinnerBlock />;

  const { settings, configured, model } = data;

  return (
    <div className="space-y-4">
      {!configured && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-800">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("Serverda OpenAI kaliti sozlanmagan (OPENAI_URL_API). Yoqilgan bo'lsa ham yordamchi ishlamaydi.")}</span>
        </div>
      )}

      <div className={cardCls}>
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">{t("AI yordamchini yoqish")}</div>
            <div className="text-[12px] text-muted-foreground">
              {t("Robot tugmasi orqali xodimlar CRM ma'lumotlari bo'yicha savol bera oladi.")}
            </div>
          </div>
          <Toggle on={settings.enabled} onChange={(v) => { if (!saving) void save({ enabled: v }); }} />
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-border/60 py-3">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">{t("Amallarga ruxsat berish")}</div>
            <div className="text-[12px] text-muted-foreground">
              {t("Yordamchi lid, kirim, chiqim, boshqa kassaga ko'chirish, o'quvchiga izoh va topshiriq qoralamasini tayyorlaydi; yozuv xodim «Tasdiqlash» ni bosgandagina saqlanadi.")}
            </div>
          </div>
          <Toggle on={settings.actionsEnabled} onChange={(v) => { if (!saving) void save({ actionsEnabled: v }); }} />
        </div>

        <div className="flex items-center justify-between gap-3 py-3">
          <label htmlFor="ai-daily-limit" className="min-w-0 flex-1 text-[13px]">
            {t("Bitta xodimga kuniga savollar soni")}
          </label>
          <input
            id="ai-daily-limit"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            step={1}
            value={limitDraft}
            disabled={saving}
            onChange={(e) => setLimitDraft(e.target.value)}
            onBlur={() => void commitLimit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="h-9 w-24 rounded-lg border border-border bg-card px-2.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1 border-t border-border/60 pt-3 text-[12px] text-muted-foreground">
          <div>{t("Model: {model}", { model: model ?? "—" })}</div>
          {settings.updatedAt && (
            <div>
              {t("Oxirgi o'zgarish: {who}, {when}", {
                who: settings.updatedBy ?? "—",
                when: uzStamp(new Date(settings.updatedAt)),
              })}
            </div>
          )}
        </div>
      </div>

      <SettingsNote>
        {t(
          "Yordamchi faqat xodimga ruxsat berilgan bo'limlar ma'lumotini oladi va hech narsani o'zi saqlamaydi: amallar yoqilgan bo'lsa ham har yozuvni xodim kartadagi «Tasdiqlash» tugmasi bilan tasdiqlaydi. Savol, o'quvchi va xodim ismlari hamda summalar OpenAI xizmatiga yuboriladi; telefon raqamlari yashiriladi. Suhbatlar 30 kun saqlanadi.",
        )}
      </SettingsNote>
    </div>
  );
}
