"use client";

import { useState } from "react";
import { ChevronDown, Cpu, EyeOff, Loader2, Lock, Plus, Send, ShieldCheck, Archive, Users } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { TextInput, fieldCls } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { AI_EFFORTS, EFFORT_LABELS, isModelId } from "@/lib/ai/models";
import type { AiEffort, AiModelRow } from "@/lib/ai/protocol";
import type { AiSettings } from "@/lib/ai/settings";

// YANGI VERSIYA — SOZLAMALAR → «MOHIRAI» (38-qism, rasm «Sozlamalar · MohirAI»). Yoqish, «Kimlar foydalanadi»
// (rol bo'yicha ruxsat va kunlik savol limiti), «Amallar — faqat tasdiq bilan» (amal turlari), «Model va tezlik»
// (sukut model va tezlik, xodimlarga ochiq modellar, model qo'shish), «Maxfiylik», oylik foydalanish.
// Server: /api/ai/settings (lib/ai/settings.ts, lib/ai/adminOverview.ts) — rol va amal cheklovlari chat'da kuchga kiradi.

type Overview = {
  month: string;
  roles: { key: string; name: string; people: number; questions: number }[];
  questions: number;
  done: number;
  cancelled: number;
  topKinds: string[];
  actionKinds: { key: string; label: string; hint: string }[];
};
type Data = { ok: true; settings: AiSettings; configured: boolean; modelRows: AiModelRow[]; enabledModels: string[]; defaultModel: string | null; overview: Overview };

function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-v2-brand" : "bg-v2-border-strong"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function Card({ Icon, title, sub, children, tone = "brand" }: { Icon: typeof Users; title: string; sub: string; children: React.ReactNode; tone?: "brand" | "warning" }) {
  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-v2-md ${tone === "warning" ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-brand-bg text-v2-brand"}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold text-v2-text">{title}</h2>
          <p className="text-v2-small text-v2-text-2">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AiSettingsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<Data>("/api/ai/settings");
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [newId, setNewId] = useState("");
  const [limits, setLimits] = useState<Record<string, string>>({});

  async function put(patch: Record<string, unknown>, ok = t("Saqlandi")) {
    setBusy(true);
    const r = await fetch("/api/ai/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(ok);
    reload();
  }

  if (error) return <div className="p-6"><NoticeBar>{t("Faqat administrator uchun")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const s = d.settings;
  const ov = d.overview;
  const roleOf = (k: string) => s.roles[k] ?? { enabled: true, limit: null };
  const setRole = (k: string, v: { enabled: boolean; limit: number | null }) => void put({ roles: { ...s.roles, [k]: v } });
  const enabledModels = d.enabledModels;
  const rows = d.modelRows;
  const visible = more ? rows : rows.slice(0, 4);
  const maxQ = Math.max(1, ...ov.roles.map((r) => r.questions));
  const used = ov.roles.filter((r) => roleOf(r.key).enabled).reduce((a, r) => a + r.people, 0);

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-v2-small text-v2-text-2">{t("Ilovalar")}</div>
          <h1 className="text-v2-page text-v2-text">MohirAI</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("AI yordamchi: xodim CRM ma'lumotlari bo'yicha savol beradi va amal so'raydi. Amal faqat xodim «Tasdiqlash»ni bosganda saqlanadi.")}</p>
        </div>
        <div className={`flex items-center gap-2 rounded-v2-md px-3 py-2 text-v2-small font-semibold ${s.enabled ? "bg-v2-success-bg text-v2-success" : "bg-v2-surface-2 text-v2-text-2"}`}>
          <Switch on={s.enabled} label="MohirAI" disabled={busy} onChange={(v) => void put({ enabled: v }, v ? t("MohirAI yoqildi") : t("MohirAI o'chirildi"))} />
          {s.enabled ? t("Yoqilgan") : t("O'chirilgan")}
        </div>
      </div>
      {!d.configured && <NoticeBar>{t("Serverda AI kaliti sozlanmagan — yoqilsa ham javob bermaydi.")}</NoticeBar>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card Icon={Users} title={t("Kimlar foydalanadi")} sub={t("Ma'lumot doirasi «Rollar va huquqlar»dan olinadi — MohirAI xodim ko'rmaydigan narsani aytmaydi")}>
            <div className="grid grid-cols-[minmax(0,1fr)_88px_52px] items-center gap-x-3 border-b border-v2-border pb-2 text-v2-caption font-semibold text-v2-text-2">
              <span>{t("Rol")}</span>
              <span className="text-right">{t("Kunlik savol")}</span>
              <span className="text-right">{t("Ruxsat")}</span>
            </div>
            <ul className="divide-y divide-v2-border">
              {ov.roles.map((r) => {
                const a = roleOf(r.key);
                const val = limits[r.key] ?? String(a.limit ?? s.dailyLimit);
                return (
                  <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_88px_52px] items-center gap-x-3 py-2.5">
                    <div className="min-w-0">
                      <div className="font-semibold text-v2-text">{t(r.name)}</div>
                      <div className="text-v2-small text-v2-text-2">{t("{n} xodim", { n: r.people })}</div>
                    </div>
                    {a.enabled ? (
                      <input
                        value={val}
                        inputMode="numeric"
                        aria-label={t("{r} — kunlik savol", { r: t(r.name) })}
                        onChange={(e) => setLimits((x) => ({ ...x, [r.key]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                        onBlur={() => {
                          const n = Number(val);
                          if (n && n !== (a.limit ?? s.dailyLimit)) setRole(r.key, { enabled: true, limit: n });
                        }}
                        className={fieldCls("default", "h-9 text-right")}
                      />
                    ) : (
                      <span className="text-right text-v2-text-3">—</span>
                    )}
                    <span className="flex justify-end">
                      <Switch on={a.enabled} label={t(r.name)} disabled={busy} onChange={(v) => setRole(r.key, { enabled: v, limit: a.limit })} />
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-v2-small text-v2-text-2">{t("{n} xodim foydalanadi · limit har kuni 00:00 da yangilanadi", { n: used })}</p>
          </Card>

          <Card Icon={Cpu} title={t("Model va tezlik")} sub={t("Xodim AI oynasida o'zi tanlaydi. O'chirilgan model ko'rinmaydi")}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-v2-text">{t("Sukut model")}</div>
                  <div className="text-v2-small text-v2-text-2">{t("Xodim tanlamasa shu ishlaydi")}</div>
                </div>
                <div className="w-48">
                  <V2Select label={t("Sukut model")} value={d.defaultModel ?? ""} onChange={(v) => void put({ defaultModel: v })} options={enabledModels.map((id) => ({ value: id, label: rows.find((r) => r.id === id)?.name ?? id }))} searchable={false} />
                </div>
              </div>
              <div>
                <div className="font-semibold text-v2-text">{t("Sukut tezlik")}</div>
                <div className="mb-2 text-v2-small text-v2-text-2">{t("Tezroq — arzonroq; chuqurroq — murakkab savolda aniqroq, lekin sekinroq")}</div>
                <div role="radiogroup" aria-label={t("Sukut tezlik")} className="inline-flex gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
                  {AI_EFFORTS.map((e) => (
                    <button key={e} type="button" role="radio" aria-checked={s.defaultEffort === e} onClick={() => void put({ defaultEffort: e as AiEffort })} className={`h-8 rounded-v2-sm px-3 text-v2-small font-semibold ${s.defaultEffort === e ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
                      {t(EFFORT_LABELS.find((x) => x.effort === e)?.label ?? e)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-v2-small font-semibold text-v2-text-2">{t("Xodimlarga ko'rinadigan modellar · {n}", { n: enabledModels.length })}</div>
                <ul className="divide-y divide-v2-border">
                  {visible.map((m) => {
                    const on = enabledModels.includes(m.id);
                    const def = d.defaultModel === m.id;
                    return (
                      <li key={m.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-semibold text-v2-text">{m.name}</span>
                            <span className="font-mono text-v2-caption text-v2-text-3">{m.id}</span>
                            {m.available === false && <span className="text-v2-caption text-v2-danger">{t("hisobda yo'q")}</span>}
                          </div>
                          <div className="text-v2-small text-v2-text-2">{t(m.hint)}</div>
                        </div>
                        {def ? (
                          <span className="rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-success">{t("Sukut")}</span>
                        ) : (
                          on && (
                            <button type="button" onClick={() => void put({ defaultModel: m.id })} className={`${secondaryBtn} h-8 px-2.5 text-v2-small`}>
                              {t("Sukut qilish")}
                            </button>
                          )
                        )}
                        <Switch on={on} label={m.name} disabled={busy || def} onChange={(v) => void put({ models: v ? [...enabledModels, m.id] : enabledModels.filter((x) => x !== m.id) })} />
                      </li>
                    );
                  })}
                </ul>
                {rows.length > 4 && (
                  <button type="button" onClick={() => setMore((x) => !x)} className="mt-1 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
                    <ChevronDown className={`size-4 transition-transform ${more ? "rotate-180" : ""}`} aria-hidden /> {more ? t("Yig'ish") : t("Yana {n} ta model", { n: rows.length - 4 })}
                  </button>
                )}
                <div className="mt-3 flex gap-2">
                  <TextInput value={newId} onChange={(e) => setNewId(e.target.value.trim())} placeholder={t("Model ID, masalan gpt-6.1-luna")} className="font-mono" />
                  <button
                    type="button"
                    disabled={!isModelId(newId) || busy}
                    onClick={() => {
                      void put({ models: [...new Set([...enabledModels, newId])] }, t("Model qo'shildi"));
                      setNewId("");
                    }}
                    className={`${secondaryBtn} shrink-0 disabled:opacity-50`}
                  >
                    <Plus className="size-4" aria-hidden /> {t("Qo'shish")}
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card Icon={Lock} tone="warning" title={t("Amallar — faqat tasdiq bilan")} sub={t("MohirAI qoralama tayyorlaydi, xodim tekshirib «Tasdiqlash»ni bosadi")}>
            <div className="flex items-center justify-between gap-3 border-b border-v2-border pb-3">
              <div>
                <div className="font-semibold text-v2-text">{t("Amallarga ruxsat")}</div>
                <div className="text-v2-small text-v2-text-2">{t("O'chirilsa MohirAI faqat savolga javob beradi")}</div>
              </div>
              <Switch on={s.actionsEnabled} label={t("Amallarga ruxsat")} disabled={busy} onChange={(v) => void put({ actionsEnabled: v })} />
            </div>
            <ul className={`divide-y divide-v2-border ${s.actionsEnabled ? "" : "opacity-50"}`}>
              {ov.actionKinds.map((k) => {
                const on = !s.disabledActions.includes(k.key);
                return (
                  <li key={k.key} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-v2-text">{t(k.label)}</div>
                      <div className="text-v2-small text-v2-text-2">{t(k.hint)}</div>
                    </div>
                    <Switch on={on} label={t(k.label)} disabled={busy || !s.actionsEnabled} onChange={(v) => void put({ disabledActions: v ? s.disabledActions.filter((x) => x !== k.key) : [...s.disabledActions, k.key] })} />
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <b className="text-v2-text">{t("Har doim tasdiq bilan — bu o'zgarmaydi.")}</b> {t("MohirAI hech qachon o'chirmaydi, narx, oylik va huquqlarni o'zgartirmaydi. Har tasdiqlangan amal Amallar jurnalida «MohirAI orqali» belgisi bilan turadi.")}
              </span>
            </div>
          </Card>

          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="mb-2 font-semibold text-v2-text">{t("Maxfiylik")}</h2>
            <ul className="space-y-2 text-v2-small text-v2-text-2">
              {[
                [Send, t("OpenAI'ga ketadi: savol, o'quvchi va xodim ismlari, summalar")],
                [EyeOff, t("Yashiriladi: telefon raqamlari")],
                [Archive, t("Suhbat 30 kun yozilmasa Arxivga o'tadi — o'chmaydi")],
                [ShieldCheck, t("Javob faqat xodimga ruxsat berilgan bo'limlardan")],
              ].map(([I, x]) => {
                const Icon = I as typeof Send;
                return (
                  <li key={String(x)} className="flex gap-2">
                    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden /> {String(x)}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("{m}da foydalanish", { m: fmt.monthName(ov.month) })}</h2>
            <div className="mt-1 text-[26px] font-semibold tabular-nums text-v2-text">
              {ov.questions} <span className="text-v2-small font-normal text-v2-text-2">{t("savol")}</span>
            </div>
            <ul className="mt-2 space-y-2">
              {ov.roles
                .filter((r) => r.questions > 0)
                .sort((a, b) => b.questions - a.questions)
                .map((r) => (
                  <li key={r.key}>
                    <div className="flex justify-between text-v2-small text-v2-text">
                      {t(r.name)} <b className="tabular-nums">{r.questions}</b>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
                      <div className="h-full rounded-full bg-v2-info" style={{ width: `${(r.questions / maxQ) * 100}%` }} />
                    </div>
                  </li>
                ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-v2-border pt-3 text-v2-small">
              <div className="flex justify-between">
                <dt className="text-v2-text-2">{t("Tasdiqlangan amal")}</dt>
                <dd className="font-semibold tabular-nums text-v2-text">{ov.done}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-v2-text-2">{t("Bekor qilingan")}</dt>
                <dd className="font-semibold tabular-nums text-v2-text">{ov.cancelled}</dd>
              </div>
              {ov.topKinds.length > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-v2-text-2">{t("Ko'p so'ralgan")}</dt>
                  <dd className="text-right text-v2-text">{ov.topKinds.map((x) => t(x)).join(", ")}</dd>
                </div>
              )}
            </dl>
            {s.updatedAt && (
              <p className="mt-3 border-t border-v2-border pt-3 text-v2-caption text-v2-text-2">{t("Oxirgi o'zgarish: {b} · {d}", { b: s.updatedBy ?? "—", d: fmt.dayMonth(s.updatedAt.slice(0, 10)) })}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
