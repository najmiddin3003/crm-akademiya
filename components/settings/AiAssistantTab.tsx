"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Plus } from "lucide-react";
import Segmented from "@/components/ui/Segmented";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { ApiError, fetchJson } from "@/lib/fetchJson";
import { uzStamp } from "@/lib/uzTime";
import { AI_EFFORTS, EFFORT_LABELS, isModelId } from "@/lib/ai/models";
import type { AiEffort, AiModelRow } from "@/lib/ai/protocol";
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
//
// MODELLAR (08.10.2026): xodimlar panelda tanlay oladigan modellar,
// sukut model va sukut «Tezlik». Har model yonida — OpenAI hisobida bor
// yoki yo'qligi (server GET /v1/models dan biladi). Narx modelga qarab
// o'n barobargacha farq qiladi — keragini qoldiring.

interface SettingsResponse {
  settings: AiSettings;
  configured: boolean;
  model: string | null;
  api: "responses" | "chat" | null;
  modelRows: AiModelRow[];
  enabledModels: string[];
  defaultModel: string | null;
}

type SavePatch = {
  enabled?: boolean;
  actionsEnabled?: boolean;
  dailyLimit?: number;
  models?: string[];
  defaultModel?: string | null;
  defaultEffort?: AiEffort;
};

const cardCls = "rounded-2xl border border-border bg-card p-4 md:p-5";

export default function AiAssistantTab() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [limitDraft, setLimitDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<SettingsResponse> => {
    const d = await fetchJson<SettingsResponse & { ok: boolean }>("/api/ai/settings");
    return {
      settings: d.settings,
      configured: d.configured,
      model: d.model,
      api: d.api ?? null,
      modelRows: d.modelRows ?? [],
      enabledModels: d.enabledModels ?? [],
      defaultModel: d.defaultModel ?? null,
    };
  }, []);

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => {
        if (!alive) return;
        setData(d);
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
  }, [load]);

  async function save(patch: SavePatch): Promise<boolean> {
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
      setData((prev) =>
        prev
          ? {
              ...prev,
              settings: d.settings as AiSettings,
              enabledModels: Array.isArray(d.enabledModels) ? d.enabledModels : prev.enabledModels,
              defaultModel: typeof d.defaultModel === "string" ? d.defaultModel : prev.defaultModel,
            }
          : prev,
      );
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

  /** Qo'lda qo'shilgan model — ro'yxat (va hisobda bor-yo'qligi) serverdan qayta olinadi. */
  async function addModel(id: string): Promise<boolean> {
    if (!data) return false;
    if (!(await save({ models: [...data.enabledModels, id] }))) return false;
    try {
      setData(await load());
    } catch {
      // ro'yxat keyingi ochilishda yangilanadi
    }
    return true;
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
          <div>{t("Sukut model (.env): {model}", { model: model ?? "—" })}</div>
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

      {configured && <ModelsCard data={data} saving={saving} save={save} addModel={addModel} />}

      <SettingsNote>
        {t(
          "Yordamchi faqat xodimga ruxsat berilgan bo'limlar ma'lumotini oladi va hech narsani o'zi saqlamaydi: amallar yoqilgan bo'lsa ham har yozuvni xodim kartadagi «Tasdiqlash» tugmasi bilan tasdiqlaydi. Savol, o'quvchi va xodim ismlari hamda summalar OpenAI xizmatiga yuboriladi; telefon raqamlari yashiriladi. Suhbatlar 30 kun saqlanadi.",
        )}
      </SettingsNote>
    </div>
  );
}

/** Xodimlar tanlaydigan modellar, sukut model va sukut «Tezlik» (4-bosqich). */
function ModelsCard({
  data,
  saving,
  save,
  addModel,
}: {
  data: SettingsResponse;
  saving: boolean;
  save: (patch: SavePatch) => Promise<boolean>;
  addModel: (id: string) => Promise<boolean>;
}) {
  const { t } = useT();
  const { showError } = useToast();
  const [custom, setCustom] = useState("");
  const { enabledModels: enabled, defaultModel, modelRows, api, settings } = data;
  const proxy = api === "chat";

  const toggle = (id: string, on: boolean) => {
    if (saving) return;
    const next = on ? [...enabled, id] : enabled.filter((x) => x !== id);
    if (!next.length) {
      showError("Kamida bitta model tanlang");
      return;
    }
    void save({ models: next, ...(on || id !== defaultModel ? {} : { defaultModel: null }) });
  };

  const submitCustom = async () => {
    const id = custom.trim();
    if (!id) return;
    if (!isModelId(id)) {
      showError("Model nomi noto'g'ri");
      return;
    }
    if (enabled.includes(id)) {
      setCustom("");
      return;
    }
    if (await addModel(id)) setCustom("");
  };

  return (
    <div className={cardCls}>
      <div className="border-b border-border/60 pb-3">
        <div className="text-[14px] font-semibold">{t("Modellar")}</div>
        <div className="text-[12px] text-muted-foreground">
          {t("Xodim AI oynasida shu modellardan birini va «Tezlik» ni tanlaydi. Hisobingizda yo'q model xodimlarga ko'rinmaydi.")}
        </div>
        {proxy && (
          <div className="mt-2 flex items-start gap-1.5 text-[12px] text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t("Server proksi (Chat Completions) orqali ishlayapti: «Tezlik» tanlanmaydi, GPT-6 Astra va GPT-6.1 Sol ishlamaydi.")}</span>
          </div>
        )}
      </div>

      <ul className="divide-y divide-border/60">
        {modelRows.map((row) => {
          const on = enabled.includes(row.id);
          const isDefault = on && row.id === defaultModel;
          return (
            <li key={row.id} className="flex items-start gap-3 py-2.5">
              <Toggle on={on} onChange={(v) => toggle(row.id, v)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] font-semibold">{row.name}</span>
                  {row.name !== row.id && <span className="font-mono text-[11px] text-muted-foreground">{row.id}</span>}
                  {row.available === true && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">{t("Hisobingizda bor")}</span>
                  )}
                  {row.available === false && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t("Hisobingizda yo'q")}</span>
                  )}
                  {proxy && row.responsesOnly && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">{t("Proksida ishlamaydi")}</span>
                  )}
                </div>
                {row.hint && <div className="text-[12px] text-muted-foreground">{t(row.hint)}</div>}
              </div>
              {on && (
                <button
                  type="button"
                  disabled={saving || isDefault}
                  onClick={() => void save({ defaultModel: row.id })}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    isDefault ? "bg-primary/10 text-primary" : "border border-border text-muted-foreground hover:bg-secondary disabled:opacity-50"
                  }`}
                >
                  {isDefault ? t("Sukut") : t("Sukut qilish")}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submitCustom();
          }}
          placeholder={t("Boshqa model ID (masalan, gpt-6.1-luna)")}
          aria-label={t("Boshqa model ID (masalan, gpt-6.1-luna)")}
          disabled={saving}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void submitCustom()}
          disabled={saving || !custom.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t("Qo'shish")}
        </button>
      </div>

      {!proxy && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <div className="text-[13px]">{t("Xodim tanlamaguncha «Tezlik»")}</div>
          <Segmented
            size="sm"
            value={settings.defaultEffort}
            onChange={(v) => {
              if (!saving && v !== settings.defaultEffort) void save({ defaultEffort: v as AiEffort });
            }}
            options={AI_EFFORTS.map((e) => {
              const l = EFFORT_LABELS.find((x) => x.effort === e);
              return { value: e, label: l?.label ?? e, hint: l?.hint };
            })}
          />
          <div className="text-[12px] text-muted-foreground">
            {t("Tezroq — arzonroq va tezroq javob; chuqurroq — murakkab savolda aniqroq, lekin sekinroq va qimmatroq. Model qabul qilmaydigan daraja eng yaqiniga almashadi.")}
          </div>
        </div>
      )}
    </div>
  );
}
